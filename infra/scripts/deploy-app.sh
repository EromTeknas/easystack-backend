#!/usr/bin/env bash
set -euo pipefail

# EasyStack Application Deploy & Health Verification Script
# Usage:
#   ./infra/scripts/deploy-app.sh <env-name>
# Example:
#   ./infra/scripts/deploy-app.sh dev
#   ./infra/scripts/deploy-app.sh prod

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <env-name>"
  echo "Example: $0 dev"
  exit 1
fi

ENV_NAME=$(echo "$1" | tr '[:upper:]' '[:lower:]')
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$INFRA_DIR/env/.env.${ENV_NAME}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Environment file not found at: $ENV_FILE"
  echo "Create one using $INFRA_DIR/env/.env.example"
  exit 1
fi

echo "=========================================================="
echo "Deploying EasyStack Application: [${ENV_NAME}]"
echo "Env File: $ENV_FILE"
echo "=========================================================="

# Export variables from env file for script use
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
export ENV_FILE="$ENV_FILE"

COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "ERROR: Neither docker compose nor docker-compose found."
  exit 1
fi

BACKEND_ROOT="$(cd "$INFRA_DIR/.." && pwd)"
FRONTEND_ROOT="$(cd "$BACKEND_ROOT/../easystack-frontend" && pwd)"

# Auto-build images if not found locally or if --build flag is provided
SHOULD_BUILD="${2:-}"
if [[ "$SHOULD_BUILD" == "--build" ]] || ! docker image inspect "${BACKEND_IMAGE:-easystack-backend:latest}" >/dev/null 2>&1; then
  echo "--> Image '${BACKEND_IMAGE:-easystack-backend:latest}' not found locally. Building backend container..."
  docker build -t "${BACKEND_IMAGE:-easystack-backend:latest}" -f "$INFRA_DIR/docker/backend.Dockerfile" "$BACKEND_ROOT"
fi

if [[ -d "$FRONTEND_ROOT" ]]; then
  if [[ "$SHOULD_BUILD" == "--build" ]] || ! docker image inspect "${FRONTEND_IMAGE:-easystack-frontend:latest}" >/dev/null 2>&1; then
    echo "--> Image '${FRONTEND_IMAGE:-easystack-frontend:latest}' not found locally. Building frontend container..."
    docker build -t "${FRONTEND_IMAGE:-easystack-frontend:latest}" -f "$FRONTEND_ROOT/Dockerfile" "$FRONTEND_ROOT"
  fi
fi

# 1. Run Database Migrations in an Ephemeral Container
echo "[1/3] Executing Prisma Database Migrations for ${ENV_NAME}..."
MIGRATION_URL="mysql://${MYSQL_MIGRATION_USER}:${MYSQL_MIGRATION_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"

# Check if running against local Docker container network
NETWORK_FLAG="--network easystack-core-net"
if ! docker network inspect easystack-core-net >/dev/null 2>&1; then
  echo "WARNING: easystack-core-net network not found. Running host network mode."
  NETWORK_FLAG="--network host"
fi

docker run --rm \
  $NETWORK_FLAG \
  -e DATABASE_URL="$MIGRATION_URL" \
  "${BACKEND_IMAGE:-easystack-backend:latest}" \
  npx prisma migrate deploy

echo "✓ Prisma migrations applied successfully."

# 2. Deploy/Update Application Containers
echo "[2/3] Rolling out containers with ${COMPOSE_CMD}..."
(
  cd "$INFRA_DIR" && \
  $COMPOSE_CMD -p "${COMPOSE_PROJECT_NAME:-easystack-${ENV_NAME}}" \
    -f compose.app.yaml \
    --env-file "$ENV_FILE" \
    up -d --remove-orphans
)

# 3. Health & Readiness Verification
echo "[3/3] Verifying container health probes..."
API_URL="http://localhost:${API_PORT:-3002}/api/health"
DELIVERY_URL="http://localhost:${DELIVERY_PORT:-3005}/health"
FRONTEND_URL="http://localhost:${FRONTEND_PORT:-3000}/"

MAX_RETRIES=20
WAIT_SECONDS=3

check_url() {
  local url="$1"
  local name="$2"
  echo -n "Checking $name ($url)... "
  for i in $(seq 1 $MAX_RETRIES); do
    if curl -s -f -o /dev/null "$url"; then
      echo "✓ Healthy!"
      return 0
    fi
    sleep $WAIT_SECONDS
  done
  echo "FAILED (timed out after $((MAX_RETRIES * WAIT_SECONDS))s)"
  return 1
}

FAILED=0
check_url "$API_URL" "Backend Core API" || FAILED=1
check_url "$DELIVERY_URL" "Backend Delivery API" || FAILED=1
check_url "$FRONTEND_URL" "Next.js Frontend" || FAILED=1

if [[ $FAILED -eq 1 ]]; then
  echo "=========================================================="
  echo "ERROR: One or more health probes failed!"
  echo "Inspecting last 50 lines of logs:"
  (
    cd "$INFRA_DIR" && \
    $COMPOSE_CMD -p "${COMPOSE_PROJECT_NAME:-easystack-${ENV_NAME}}" \
      -f compose.app.yaml \
      logs --tail=50
  )
  echo "Deployment FAILED."
  exit 1
fi

echo "=========================================================="
echo "SUCCESS: EasyStack [${ENV_NAME}] deployment verified healthy!"
echo "  Frontend URL:     http://localhost:${FRONTEND_PORT:-3000}"
echo "  Backend API:      http://localhost:${API_PORT:-3002}"
echo "  Delivery API:     http://localhost:${DELIVERY_PORT:-3005}"
echo "=========================================================="
