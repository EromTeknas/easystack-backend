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
TARGET_ENV_FILE="$INFRA_DIR/env/.env.${ENV_NAME}"

if [[ ! -f "$TARGET_ENV_FILE" ]]; then
  echo "ERROR: Environment file not found at: $TARGET_ENV_FILE"
  echo "Create one using $INFRA_DIR/env/.env.example"
  exit 1
fi

echo "=========================================================="
echo "Deploying EasyStack Application: [${ENV_NAME}]"
echo "Env File: $TARGET_ENV_FILE"
echo "=========================================================="

# Export variables from env file for script use
set -a
# shellcheck disable=SC1090
source "$TARGET_ENV_FILE"
set +a
# Re-assert canonical absolute path so sourced relative variables don't clobber it
export ENV_FILE="$TARGET_ENV_FILE"

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
    FRONTEND_BUILD_ARGS=()
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "$line" =~ ^(NEXT_PUBLIC_[A-Za-z0-9_]+)= ]]; then
        var_name="${BASH_REMATCH[1]}"
        var_val="${!var_name}"
        FRONTEND_BUILD_ARGS+=(--build-arg "${var_name}=${var_val}")
      fi
    done < "$TARGET_ENV_FILE"

    docker build ${FRONTEND_BUILD_ARGS[@]+"${FRONTEND_BUILD_ARGS[@]}"} -t "${FRONTEND_IMAGE:-easystack-frontend:latest}" -f "$FRONTEND_ROOT/Dockerfile" "$FRONTEND_ROOT"
  fi
fi

# 1. Ensure MySQL and MongoDB Environment Databases & Users are Provisioned
echo "[1/4] Ensuring database environment '${ENV_NAME}' and users exist..."

# Read root credentials from $INFRA_DIR/.env if present, or inherit from environment
INFRA_ENV_FILE="$INFRA_DIR/.env"
MYSQL_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-}"
MONGO_ROOT_USER_VAL="${MONGO_ROOT_USER:-admin}"
MONGO_ROOT_PASS_VAL="${MONGO_ROOT_PASSWORD:-}"
if [[ -f "$INFRA_ENV_FILE" ]]; then
  PARSED_MYSQL_PASS=$(grep -E '^MYSQL_ROOT_PASSWORD=' "$INFRA_ENV_FILE" | cut -d= -f2- | tr -d '"\r\n' || true)
  [[ -n "$PARSED_MYSQL_PASS" ]] && MYSQL_ROOT_PASS="$PARSED_MYSQL_PASS"
  PARSED_MONGO_USER=$(grep -E '^MONGO_ROOT_USER=' "$INFRA_ENV_FILE" | cut -d= -f2- | tr -d '"\r\n' || true)
  [[ -n "$PARSED_MONGO_USER" ]] && MONGO_ROOT_USER_VAL="$PARSED_MONGO_USER"
  PARSED_MONGO_PASS=$(grep -E '^MONGO_ROOT_PASSWORD=' "$INFRA_ENV_FILE" | cut -d= -f2- | tr -d '"\r\n' || true)
  [[ -n "$PARSED_MONGO_PASS" ]] && MONGO_ROOT_PASS_VAL="$PARSED_MONGO_PASS"
fi

if [[ -z "$MYSQL_ROOT_PASS" ]]; then
  echo "ERROR: MYSQL_ROOT_PASSWORD is required in $INFRA_ENV_FILE or environment to provision databases."
  exit 1
fi

# Sync MySQL
if docker ps --format '{{.Names}}' | grep -q "^easystack-mysql$"; then
  echo "--> Provisioning MySQL database '${MYSQL_DATABASE}' and users '${MYSQL_MIGRATION_USER}', '${MYSQL_APP_USER}'..."
  docker exec -i easystack-mysql mysql -u root -p"${MYSQL_ROOT_PASS}" <<-EOSQL
    CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE_SHADOW:-${MYSQL_DATABASE}_shadow}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '${MYSQL_MIGRATION_USER}'@'%' IDENTIFIED BY '${MYSQL_MIGRATION_PASSWORD}';
    ALTER USER '${MYSQL_MIGRATION_USER}'@'%' IDENTIFIED BY '${MYSQL_MIGRATION_PASSWORD}';
    CREATE USER IF NOT EXISTS '${MYSQL_APP_USER}'@'%' IDENTIFIED BY '${MYSQL_APP_PASSWORD}';
    ALTER USER '${MYSQL_APP_USER}'@'%' IDENTIFIED BY '${MYSQL_APP_PASSWORD}';
    GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_MIGRATION_USER}'@'%';
    GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE_SHADOW:-${MYSQL_DATABASE}_shadow}\`.* TO '${MYSQL_MIGRATION_USER}'@'%';
    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_APP_USER}'@'%';
    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`${MYSQL_DATABASE_SHADOW:-${MYSQL_DATABASE}_shadow}\`.* TO '${MYSQL_APP_USER}'@'%';
    FLUSH PRIVILEGES;
EOSQL
  echo "✓ MySQL database and users synchronized with ${TARGET_ENV_FILE}."
fi

# Sync MongoDB
if docker ps --format '{{.Names}}' | grep -q "^easystack-mongodb$"; then
  PARSED_MONGO_APP_USER=$(echo "${MONGO_URI:-}" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  PARSED_MONGO_APP_PASS=$(echo "${MONGO_URI:-}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  MONGO_APP_DB="easystack_${ENV_NAME}"
  if [[ -n "$PARSED_MONGO_APP_USER" ]] && [[ -n "$PARSED_MONGO_APP_PASS" ]]; then
    if [[ "$PARSED_MONGO_APP_USER" == "$MONGO_ROOT_USER_VAL" ]]; then
      echo "--> Note: MONGO_URI uses cluster root admin '${MONGO_ROOT_USER_VAL}'. Preserving root privileges."
    else
      echo "--> Provisioning MongoDB user '${PARSED_MONGO_APP_USER}' on database '${MONGO_APP_DB}'..."
      docker exec -i easystack-mongodb mongosh -u "$MONGO_ROOT_USER_VAL" -p "$MONGO_ROOT_PASS_VAL" --authenticationDatabase admin admin --eval "
        const user = '$PARSED_MONGO_APP_USER';
        const pwd = '$PARSED_MONGO_APP_PASS';
        const dbName = '$MONGO_APP_DB';
        const roles = [{ role: 'readWrite', db: dbName }, { role: 'dbAdmin', db: dbName }];
        if (!db.getUser(user)) {
          db.createUser({ user, pwd, roles });
          print('Created MongoDB user: ' + user);
        } else {
          db.updateUser(user, { pwd, roles });
          print('Updated MongoDB user: ' + user);
        }
      " >/dev/null 2>&1 || true
      echo "✓ MongoDB user synchronized with ${TARGET_ENV_FILE}."
    fi
  fi
fi

# 2. Run Database Migrations in an Ephemeral Container
echo "[2/5] Executing Prisma Database Migrations for ${ENV_NAME}..."
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

# 3. Run Database Seeders in an Ephemeral Container
echo "[3/5] Executing Database Seeders for ${ENV_NAME}..."
SEED_FLAG=""
if [[ "$ENV_NAME" == "dev" ]] || [[ "$*" =~ --seed ]]; then
  SEED_FLAG="--users"
fi

docker run --rm \
  $NETWORK_FLAG \
  --env-file "$TARGET_ENV_FILE" \
  -e DATABASE_URL="$MIGRATION_URL" \
  "${BACKEND_IMAGE:-easystack-backend:latest}" \
  npx ts-node prisma/seed.ts $SEED_FLAG

echo "✓ Database seeders applied successfully."

# 4. Deploy/Update Application Containers
echo "[4/5] Rolling out containers with ${COMPOSE_CMD}..."
(
  cd "$INFRA_DIR" && \
  $COMPOSE_CMD -p "${COMPOSE_PROJECT_NAME:-easystack-${ENV_NAME}}" \
    -f compose.app.yaml \
    --env-file "$TARGET_ENV_FILE" \
    up -d --remove-orphans
)

# 5. Health & Readiness Verification
echo "[5/5] Verifying container health probes..."
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
