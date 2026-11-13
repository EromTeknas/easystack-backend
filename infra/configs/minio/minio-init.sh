#!/bin/sh
set -e

echo "Waiting for MinIO to accept connections on port 9000..."
until /usr/bin/mc alias set myminio http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  echo "MinIO not ready yet, retrying in 2 seconds..."
  sleep 2
done

echo "MinIO is ready. Initializing S3 buckets for environments: [${ENVIRONMENTS}]..."

OLD_IFS="$IFS"
IFS=','
for ENV in $ENVIRONMENTS; do
  ENV=$(echo "$ENV" | tr -d '[:space:]')
  [ -z "$ENV" ] && continue

  BUCKET_NAME="${STORAGE_S3_BUCKET_PREFIX:-easystack}-${ENV}"
  echo "--> Provisioning MinIO S3 bucket: ${BUCKET_NAME}..."
  /usr/bin/mc mb --ignore-existing "myminio/${BUCKET_NAME}" || true
  /usr/bin/mc anonymous set download "myminio/${BUCKET_NAME}/public" || true
done
IFS="$OLD_IFS"

echo "MinIO bucket initialization complete."
