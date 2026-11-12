#!/bin/sh
set -e

echo "Waiting for SeaweedFS Filer to accept HTTP connections on port 8888..."
until wget -q -O - http://seaweedfs:8888/ >/dev/null 2>&1; do
  echo "SeaweedFS Filer not ready yet, retrying in 2 seconds..."
  sleep 2
done

ENVIRONMENTS="${ENVIRONMENTS:-dev,staging,prod}"
BUCKET_PREFIX="${STORAGE_S3_BUCKET_PREFIX:-easystack}"

echo "SeaweedFS is ready. Initializing S3 buckets for environments: [${ENVIRONMENTS}]..."

OLD_IFS="$IFS"
IFS=','
for ENV in $ENVIRONMENTS; do
  ENV=$(echo "$ENV" | tr -d '[:space:]')
  [ -z "$ENV" ] && continue

  BUCKET_NAME="${BUCKET_PREFIX}-${ENV}"
  echo "--> Provisioning SeaweedFS S3 bucket: ${BUCKET_NAME}..."

  # Create bucket directory and public subfolder in SeaweedFS Filer
  wget -q -O - --post-data="" "http://seaweedfs:8888/buckets/${BUCKET_NAME}/" >/dev/null 2>&1 || true
  wget -q -O - --post-data="" "http://seaweedfs:8888/buckets/${BUCKET_NAME}/public/" >/dev/null 2>&1 || true
done
IFS="$OLD_IFS"

echo "SeaweedFS bucket initialization complete."
