#!/usr/bin/env bash
set -euo pipefail

# EasyStack On-Demand Database Seeder Script
# Usage:
#   ./infra/scripts/seed-db.sh <env-name> [--users] [--travel]

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <env-name> [--users] [--travel]"
  echo "Example: $0 dev --users"
  exit 1
fi

ENV_NAME=$(echo "$1" | tr '[:upper:]' '[:lower:]')
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_ENV_FILE="$INFRA_DIR/env/.env.${ENV_NAME}"

if [[ ! -f "$TARGET_ENV_FILE" ]]; then
  echo "ERROR: Environment file not found at: $TARGET_ENV_FILE"
  exit 1
fi

# Export variables
set -a
# shellcheck disable=SC1090
source "$TARGET_ENV_FILE"
set +a
export ENV_FILE="$TARGET_ENV_FILE"

NETWORK_FLAG="--network easystack-core-net"
if ! docker network inspect easystack-core-net >/dev/null 2>&1; then
  echo "WARNING: easystack-core-net network not found. Running in host network mode."
  NETWORK_FLAG="--network host"
fi

MIGRATION_URL="mysql://${MYSQL_MIGRATION_USER}:${MYSQL_MIGRATION_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"

echo "=========================================================="
echo "Seeding EasyStack Database for Environment: [${ENV_NAME}]"
echo "Env File: $TARGET_ENV_FILE"
echo "=========================================================="

shift 1 || true
SEED_ARGS="${*:-}"

docker run --rm \
  $NETWORK_FLAG \
  --env-file "$TARGET_ENV_FILE" \
  -e DATABASE_URL="$MIGRATION_URL" \
  "${BACKEND_IMAGE:-easystack-backend:latest}" \
  npx ts-node prisma/seed.ts $SEED_ARGS

echo "=========================================================="
echo "✓ Database Seeding completed successfully for [${ENV_NAME}]."
echo "=========================================================="
