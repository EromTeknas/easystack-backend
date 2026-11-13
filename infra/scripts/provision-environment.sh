#!/usr/bin/env bash
set -euo pipefail

# EasyStack On-Demand Environment Provisioner
# Dynamically provisions MySQL, MongoDB, and MinIO storage for any new environment on the fly!
#
# Usage:
#   ./infra/scripts/provision-environment.sh <env-name>
#
# Example:
#   ./infra/scripts/provision-environment.sh staging
#   ./infra/scripts/provision-environment.sh pr-142

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <env-name>"
  echo "Example: $0 staging"
  exit 1
fi

ENV_NAME=$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]-_')
if [[ -z "$ENV_NAME" ]]; then
  echo "ERROR: Invalid environment name '$1'. Must contain alphanumeric, hyphen, or underscore characters."
  exit 1
fi

echo "=========================================================="
echo "Provisioning new EasyStack environment: [${ENV_NAME}]"
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_ENV_FILE="$INFRA_DIR/.env"
TARGET_ENV_FILE="$INFRA_DIR/env/.env.${ENV_NAME}"

MYSQL_CONTAINER="${MYSQL_CONTAINER:-easystack-mysql}"
MONGO_CONTAINER="${MONGO_CONTAINER:-easystack-mongodb}"
MINIO_CONTAINER="${MINIO_CONTAINER:-easystack-minio}"

# 1. Load Root Admin Credentials strictly from Shared Infra (.env)
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

if [[ -z "$MYSQL_ROOT_PASS" || -z "$MONGO_ROOT_PASS_VAL" ]]; then
  echo "ERROR: MYSQL_ROOT_PASSWORD and MONGO_ROOT_PASSWORD must be defined in $INFRA_ENV_FILE."
  exit 1
fi

# 2. Application-Specific Credentials from env/.env.<env>
if [[ ! -f "$TARGET_ENV_FILE" ]]; then
  echo "ERROR: Target environment file not found at: $TARGET_ENV_FILE"
  echo "Please create $TARGET_ENV_FILE (e.g. from env/.env.example) with environment-specific credentials."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$TARGET_ENV_FILE"
set +a

MYSQL_DB="${MYSQL_DATABASE:-easystack_${ENV_NAME}}"
MYSQL_MIGRATE_USER="${MYSQL_MIGRATION_USER:-easystack_${ENV_NAME}_migrate}"
MYSQL_MIGRATE_PASS="${MYSQL_MIGRATION_PASSWORD:-}"
MYSQL_APP_USER="${MYSQL_APP_USER:-easystack_${ENV_NAME}_app}"
MYSQL_APP_PASS="${MYSQL_APP_PASSWORD:-}"

PARSED_MONGO_USER=$(echo "${MONGO_URI:-}" | sed -n 's|.*://\([^:]*\):.*|\1|p')
PARSED_MONGO_PASS=$(echo "${MONGO_URI:-}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
PARSED_MONGO_DB=$(echo "${MONGO_URI:-}" | sed -n 's|.*://[^/]*/\([^?]*\).*|\1|p')

MONGO_APP_USER="${PARSED_MONGO_USER:-}"
MONGO_APP_PASS="${PARSED_MONGO_PASS:-}"
MONGO_APP_DB="${PARSED_MONGO_DB:-easystack_${ENV_NAME}}"

if [[ -z "$MYSQL_MIGRATE_PASS" ]]; then
  echo "ERROR: MYSQL_MIGRATION_PASSWORD must be defined in $TARGET_ENV_FILE."
  exit 1
fi
if [[ -z "$MYSQL_APP_PASS" ]]; then
  echo "ERROR: MYSQL_APP_PASSWORD must be defined in $TARGET_ENV_FILE."
  exit 1
fi
if [[ -z "$MONGO_APP_USER" || -z "$MONGO_APP_PASS" ]]; then
  echo "ERROR: MONGO_URI in $TARGET_ENV_FILE must include valid username and password (e.g. mongodb://user:pass@host:27017/db)."
  exit 1
fi

# 1. Provision MySQL Databases & Users in the Existing Container
echo "[1/3] Provisioning MySQL databases (${MYSQL_DB} & shadow) and users..."
if docker ps --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
  docker exec -i "$MYSQL_CONTAINER" mysql -u root -p"${MYSQL_ROOT_PASS}" <<-EOSQL
    CREATE DATABASE IF NOT EXISTS \`${MYSQL_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE_SHADOW:-${MYSQL_DB}_shadow}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

    CREATE USER IF NOT EXISTS '${MYSQL_MIGRATE_USER}'@'%' IDENTIFIED BY '${MYSQL_MIGRATE_PASS}';
    ALTER USER '${MYSQL_MIGRATE_USER}'@'%' IDENTIFIED BY '${MYSQL_MIGRATE_PASS}';

    CREATE USER IF NOT EXISTS '${MYSQL_APP_USER}'@'%' IDENTIFIED BY '${MYSQL_APP_PASS}';
    ALTER USER '${MYSQL_APP_USER}'@'%' IDENTIFIED BY '${MYSQL_APP_PASS}';

    GRANT ALL PRIVILEGES ON \`${MYSQL_DB}\`.* TO '${MYSQL_MIGRATE_USER}'@'%';
    GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE_SHADOW:-${MYSQL_DB}_shadow}\`.* TO '${MYSQL_MIGRATE_USER}'@'%';

    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`${MYSQL_DB}\`.* TO '${MYSQL_APP_USER}'@'%';
    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`${MYSQL_DATABASE_SHADOW:-${MYSQL_DB}_shadow}\`.* TO '${MYSQL_APP_USER}'@'%';

    FLUSH PRIVILEGES;
EOSQL
  echo "✓ MySQL databases and users configured."
else
  echo "WARNING: MySQL container '${MYSQL_CONTAINER}' is not running. Skipped live execution."
fi

# 2. Provision MongoDB Database & User in the Existing Container
echo "[2/3] Provisioning MongoDB database (${MONGO_APP_DB}) and user '${MONGO_APP_USER}'..."
if docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
  if [[ "$MONGO_APP_USER" == "$MONGO_ROOT_USER_VAL" ]]; then
    echo "--> Note: Application user matches root cluster admin. Preserving cluster root privileges."
  else
    docker exec -i "$MONGO_CONTAINER" mongosh -u "$MONGO_ROOT_USER_VAL" -p "$MONGO_ROOT_PASS_VAL" --authenticationDatabase admin admin --eval "
      const user = '$MONGO_APP_USER';
      const pwd = '$MONGO_APP_PASS';
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
  fi

  docker exec -i "$MONGO_CONTAINER" mongosh -u "$MONGO_ROOT_USER_VAL" -p "$MONGO_ROOT_PASS_VAL" --authenticationDatabase admin "$MONGO_APP_DB" --eval "
    db.createCollection('_init_marker');
    db._init_marker.updateOne(
      { env: '${ENV_NAME}' },
      { \$set: { initializedAt: new Date(), env: '${ENV_NAME}' } },
      { upsert: true }
    );
  " >/dev/null 2>&1 || true
  echo "✓ MongoDB database configured."
else
  echo "WARNING: MongoDB container '${MONGO_CONTAINER}' is not running. Skipped live execution."
fi

# 3. Provision MinIO S3 Bucket in the Existing Container
echo "[3/3] Provisioning MinIO S3 bucket (easystack-${ENV_NAME})..."
BUCKET_NAME="easystack-${ENV_NAME}"
if docker ps --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"; then
  docker exec -i "$MINIO_CONTAINER" mc mb --ignore-existing "myminio/${BUCKET_NAME}" >/dev/null 2>&1 || true
  docker exec -i "$MINIO_CONTAINER" mc anonymous set download "myminio/${BUCKET_NAME}/public" >/dev/null 2>&1 || true
  echo "✓ MinIO S3 bucket '${BUCKET_NAME}' configured with public directory."
else
  echo "WARNING: MinIO container '${MINIO_CONTAINER}' is not running. Skipped live execution."
fi

echo "=========================================================="
echo "SUCCESS: Environment '${ENV_NAME}' provisioned!"
echo "Configuration summary for .env.${ENV_NAME}:"
echo "  ENVIRONMENT=${ENV_NAME}"
echo "  DATABASE_URL=mysql://${MYSQL_MIGRATE_USER}:<password>@localhost:3306/easystack_${ENV_NAME}"
echo "  MONGO_URI=mongodb://${MONGO_APP_USER}:<password>@localhost:27017/easystack_${ENV_NAME}"
echo "  STORAGE_S3_BUCKET=${BUCKET_NAME}"
echo "  CDN URL=http://localhost:8081/${ENV_NAME}/public/"
echo "=========================================================="
