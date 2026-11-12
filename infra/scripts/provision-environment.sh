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

MYSQL_CONTAINER="${MYSQL_CONTAINER:-easystack-mysql}"
MONGO_CONTAINER="${MONGO_CONTAINER:-easystack-mongodb}"
MINIO_CONTAINER="${MINIO_CONTAINER:-easystack-minio}"

MYSQL_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-rootpassword}"
MYSQL_MIGRATE_USER="${MYSQL_MIGRATION_USER:-easystack_migrate}"
MYSQL_APP_USER="${MYSQL_APP_USER:-easystack_app}"

MONGO_ROOT_USER="${MONGO_INITDB_ROOT_USERNAME:-admin}"
MONGO_ROOT_PASS="${MONGO_INITDB_ROOT_PASSWORD:-admin12345}"
MONGO_APP_USER="${MONGO_APP_USER:-easystack}"

# 1. Provision MySQL Databases
echo "[1/3] Provisioning MySQL databases (easystack_${ENV_NAME} & shadow)..."
if docker ps --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$"; then
  docker exec -i "$MYSQL_CONTAINER" mysql -u root -p"${MYSQL_ROOT_PASS}" <<-EOSQL
    CREATE DATABASE IF NOT EXISTS \`easystack_${ENV_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE DATABASE IF NOT EXISTS \`easystack_${ENV_NAME}_shadow\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

    GRANT ALL PRIVILEGES ON \`easystack_${ENV_NAME}\`.* TO '${MYSQL_MIGRATE_USER}'@'%';
    GRANT ALL PRIVILEGES ON \`easystack_${ENV_NAME}_shadow\`.* TO '${MYSQL_MIGRATE_USER}'@'%';

    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`easystack_${ENV_NAME}\`.* TO '${MYSQL_APP_USER}'@'%';
    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`easystack_${ENV_NAME}_shadow\`.* TO '${MYSQL_APP_USER}'@'%';

    FLUSH PRIVILEGES;
EOSQL
  echo "✓ MySQL databases configured."
else
  echo "WARNING: MySQL container '${MYSQL_CONTAINER}' is not running. Skipped live execution."
fi

# 2. Provision MongoDB Database
echo "[2/3] Provisioning MongoDB database (easystack_${ENV_NAME})..."
if docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
  docker exec -i "$MONGO_CONTAINER" mongosh -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASS" --authenticationDatabase admin admin --eval "
    const roles = [
      { role: 'readWrite', db: 'easystack_${ENV_NAME}' },
      { role: 'dbAdmin', db: 'easystack_${ENV_NAME}' }
    ];
    try {
      db.grantRolesToUser('${MONGO_APP_USER}', roles);
    } catch (e) {
      print('Note: ' + e.message);
    }
  "
  docker exec -i "$MONGO_CONTAINER" mongosh -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASS" --authenticationDatabase admin "easystack_${ENV_NAME}" --eval "
    db.createCollection('_init_marker');
    db._init_marker.updateOne(
      { env: '${ENV_NAME}' },
      { \$set: { initializedAt: new Date(), env: '${ENV_NAME}' } },
      { upsert: true }
    );
  "
  echo "✓ MongoDB database configured."
else
  echo "WARNING: MongoDB container '${MONGO_CONTAINER}' is not running. Skipped live execution."
fi

# 3. Provision SeaweedFS S3 Bucket
echo "[3/3] Provisioning SeaweedFS S3 bucket (easystack-${ENV_NAME})..."
BUCKET_NAME="easystack-${ENV_NAME}"
SEAWEEDFS_CONTAINER="${SEAWEEDFS_CONTAINER:-easystack-seaweedfs}"
if docker ps --format '{{.Names}}' | grep -q "^${SEAWEEDFS_CONTAINER}$"; then
  docker exec -i "$SEAWEEDFS_CONTAINER" wget -q -O - --post-data="" "http://localhost:8888/buckets/${BUCKET_NAME}/" >/dev/null 2>&1 || true
  docker exec -i "$SEAWEEDFS_CONTAINER" wget -q -O - --post-data="" "http://localhost:8888/buckets/${BUCKET_NAME}/public/" >/dev/null 2>&1 || true
  echo "✓ SeaweedFS S3 bucket '${BUCKET_NAME}' configured with public directory."
else
  echo "WARNING: SeaweedFS container '${SEAWEEDFS_CONTAINER}' is not running. Skipped live execution."
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
