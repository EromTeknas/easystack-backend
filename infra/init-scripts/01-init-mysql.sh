#!/bin/bash
set -euo pipefail

# Dynamic MySQL Environment Initialization Script
# Supports comma-separated environments via $ENVIRONMENTS (default: "dev,staging,prod")

ENVIRONMENTS="${ENVIRONMENTS:-dev,staging,prod}"
MIGRATION_USER="${MYSQL_MIGRATION_USER:-easystack_migrate}"
MIGRATION_PASS="${MYSQL_MIGRATION_PASSWORD:-strong-migration-password}"
APP_USER="${MYSQL_APP_USER:-easystack_app}"
APP_PASS="${MYSQL_APP_PASSWORD:-strong-app-password}"

echo "=========================================================="
echo "MySQL: Provisioning environments: [${ENVIRONMENTS}]"
echo "=========================================================="

# Create common migration and app users if they don't exist
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
  CREATE USER IF NOT EXISTS '${MIGRATION_USER}'@'%' IDENTIFIED BY '${MIGRATION_PASS}';
  CREATE USER IF NOT EXISTS '${APP_USER}'@'%' IDENTIFIED BY '${APP_PASS}';
EOSQL

IFS=',' read -ra ENVS <<< "$ENVIRONMENTS"
for ENV in "${ENVS[@]}"; do
  ENV=$(echo "$ENV" | tr -d '[:space:]')
  [ -z "$ENV" ] && continue

  DB_NAME="easystack_${ENV}"
  SHADOW_DB_NAME="easystack_${ENV}_shadow"

  echo "--> Provisioning databases: ${DB_NAME} & ${SHADOW_DB_NAME}..."

  mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
    CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE DATABASE IF NOT EXISTS \`${SHADOW_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

    -- Grant full DDL + DML to migration user for migrations
    GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${MIGRATION_USER}'@'%';
    GRANT ALL PRIVILEGES ON \`${SHADOW_DB_NAME}\`.* TO '${MIGRATION_USER}'@'%';

    -- Grant runtime DML privileges to application user
    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`${DB_NAME}\`.* TO '${APP_USER}'@'%';
    GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON \`${SHADOW_DB_NAME}\`.* TO '${APP_USER}'@'%';
EOSQL
done

mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "FLUSH PRIVILEGES;"
echo "MySQL: All environments initialized successfully."
