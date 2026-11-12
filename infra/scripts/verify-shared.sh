#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================================="
echo "EasyStack Shared Infrastructure Verification"
echo "=========================================================="
echo "Infra Directory: $INFRA_DIR"

# 1. Validate Docker and Docker Compose
echo "[1/4] Checking Docker CLI and Docker Compose..."
if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker command not found."
  exit 1
fi

COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "ERROR: neither 'docker compose' nor 'docker-compose' found."
  exit 1
fi
echo "Using compose command: $COMPOSE_CMD"

# 2. Validate Compose File Syntax
echo "[2/4] Validating compose.shared.yaml syntax..."
(cd "$INFRA_DIR" && $COMPOSE_CMD -f compose.shared.yaml config --quiet)
echo "✓ compose.shared.yaml is valid."

echo "[3/5] Validating compose.observability.yaml syntax..."
(cd "$INFRA_DIR" && $COMPOSE_CMD -f compose.observability.yaml config --quiet)
echo "✓ compose.observability.yaml is valid."

echo "[4/5] Validating compose.app.yaml (Dev and Prod configurations)..."
(cd "$INFRA_DIR" && $COMPOSE_CMD -f compose.app.yaml --env-file env/.env.dev config --quiet)
(cd "$INFRA_DIR" && $COMPOSE_CMD -f compose.app.yaml --env-file env/.env.prod config --quiet)
echo "✓ compose.app.yaml is valid for both Dev and Prod."

# 3. Validate Jenkins Dockerfile
echo "[5/5] Validating Jenkins Dockerfile build context..."
if [[ -f "$INFRA_DIR/docker/jenkins.Dockerfile" ]]; then
  echo "✓ Jenkins Dockerfile present."
else
  echo "ERROR: $INFRA_DIR/docker/jenkins.Dockerfile not found."
  exit 1
fi

echo "=========================================================="
echo "All static verifications passed successfully!"
echo "To start the shared infrastructure, run:"
echo "  cd $INFRA_DIR && $COMPOSE_CMD -f compose.shared.yaml up -d"
echo "=========================================================="
