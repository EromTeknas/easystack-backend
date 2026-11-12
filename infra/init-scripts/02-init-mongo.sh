#!/bin/bash
set -euo pipefail

# Dynamic MongoDB Environment Initialization Script
# Supports comma-separated environments via $ENVIRONMENTS (default: "dev,staging,prod")

ENVIRONMENTS="${ENVIRONMENTS:-dev,staging,prod}"
APP_USER="${MONGO_APP_USER:-easystack}"
APP_PASS="${MONGO_APP_PASSWORD:-strong-password}"
ROOT_USER="${MONGO_INITDB_ROOT_USERNAME:-admin}"
ROOT_PASS="${MONGO_INITDB_ROOT_PASSWORD:-admin12345}"

echo "=========================================================="
echo "MongoDB: Provisioning environments: [${ENVIRONMENTS}]"
echo "=========================================================="

IFS=',' read -ra ENVS <<< "$ENVIRONMENTS"

# Build roles JSON array
ROLES_JSON="[]"
for ENV in "${ENVS[@]}"; do
  ENV=$(echo "$ENV" | tr -d '[:space:]')
  [ -z "$ENV" ] && continue
  DB_NAME="easystack_${ENV}"
  ROLES_JSON=$(echo "$ROLES_JSON" | jq --arg db "$DB_NAME" '. + [{role: "readWrite", db: $db}, {role: "dbAdmin", db: $db}]')
done

# Provision user on admin db
mongosh -u "$ROOT_USER" -p "$ROOT_PASS" --authenticationDatabase admin admin --eval "
  const existingUser = db.getUser('$APP_USER');
  const roles = $ROLES_JSON;
  if (!existingUser) {
    db.createUser({ user: '$APP_USER', pwd: '$APP_PASS', roles: roles });
    print('Created MongoDB user: $APP_USER');
  } else {
    db.updateUser('$APP_USER', { roles: roles });
    print('Updated roles for MongoDB user: $APP_USER');
  }
"

# Initialize databases
for ENV in "${ENVS[@]}"; do
  ENV=$(echo "$ENV" | tr -d '[:space:]')
  [ -z "$ENV" ] && continue
  DB_NAME="easystack_${ENV}"
  echo "--> Initializing MongoDB database: ${DB_NAME}..."
  mongosh -u "$ROOT_USER" -p "$ROOT_PASS" --authenticationDatabase admin "$DB_NAME" --eval "
    db.createCollection('_init_marker');
    db._init_marker.updateOne(
      { env: '$ENV' },
      { \$set: { initializedAt: new Date(), env: '$ENV' } },
      { upsert: true }
    );
  "
done

echo "MongoDB: All environments initialized successfully."
