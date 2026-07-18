#!/bin/sh
set -eu

until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; do
  sleep 1
done

mc mb --ignore-existing "local/$STORAGE_S3_BUCKET"
mc cors set "local/$STORAGE_S3_BUCKET" /cors.json
mc anonymous set-json /dev/stdin "local/$STORAGE_S3_BUCKET" <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::$STORAGE_S3_BUCKET/public/*"]}]}
EOF
