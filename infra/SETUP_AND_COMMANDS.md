# EasyStack Infrastructure & Deployment Master Reference (SETUP_AND_COMMANDS.md)

This document is the **single source of truth** for building, deploying, resetting, and operating all EasyStack containers, stateful infrastructure, observability services, and CI/CD pipelines.

---

## ⚠️ CRITICAL NOTICE: Docker Compose v2 vs v1

> [!CAUTION]
> **ALWAYS** use `docker compose` (with a space, Docker Compose v2).  
> **NEVER** use `docker-compose` (with a hyphen, Python v1).  
>
> Modern Docker Engine (v26+) removed `ContainerConfig` from its container inspect payload. Running the legacy Python tool `docker-compose` will crash with:  
> `KeyError: 'ContainerConfig' [Failed to execute script docker-compose]`.  
> `docker compose` (v2 plugin written in Go) natively supports modern Docker Engine.

---

## 1. Complete Fresh Teardown & Rebuild (One-Shot Reset)

If you want to completely wipe all EasyStack containers, volumes (clean database reset), and local application images, copy and run:

```bash
# 1. Stop and remove all EasyStack containers
docker rm -f $(docker ps -aq --filter "name=easystack") 2>/dev/null || true

# 2. Remove all EasyStack volumes (resets MySQL, MongoDB, Redis, SeaweedFS, Jenkins, Grafana, Loki)
docker volume rm \
  easystack-shared_mysql_data \
  easystack-shared_mongo_data \
  easystack-shared_redis_data \
  easystack-shared_seaweed_data \
  easystack-shared_nginx_cache \
  easystack-shared_jenkins_home \
  easystack-observability_prometheus_data \
  easystack-observability_grafana_data \
  easystack-observability_loki_data 2>/dev/null || true

# 3. Remove locally built EasyStack images
docker rmi \
  easystack-backend:dev-latest \
  easystack-frontend:dev-latest \
  easystack-shared-jenkins:latest 2>/dev/null || true

# 4. Recreate external networks
docker network create easystack-core-net 2>/dev/null || true
docker network create easystack-edge-net 2>/dev/null || true
docker network create easystack-ci-net 2>/dev/null || true

# 5. Start Shared Infrastructure (MySQL, MongoDB, Redis, SeaweedFS, CDN, Jenkins)
cd /home/eteknas/Projects/easystack-backend/infra
docker compose -p easystack-shared -f compose.shared.yaml up -d --build

# 6. Start Observability Stack (Prometheus, Grafana, Loki, Promtail, cAdvisor)
docker compose -p easystack-observability -f compose.observability.yaml up -d

# 7. Deploy Development Application (Core API, Delivery API, Workers, Frontend)
cd /home/eteknas/Projects/easystack-backend
./infra/scripts/deploy-app.sh dev --build
```

---

## 2. Service Directory, Ports & Health Endpoints

| Service | Container Name | Port Mapping | Health / Test Endpoint | Credentials / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Next.js Frontend** | `easystack-dev_frontend` | `3000:3000` | `http://localhost:3000/` | Web UI (calls Backend directly on `:3002`) |
| **Backend Core API** | `easystack-dev_backend-api` | `3002:3000` | `http://localhost:3002/api/health` | Express + Prisma + Mongoose |
| **BullMQ Queue Dashboard** | `easystack-dev_backend-api` | `3002:3000` | `http://localhost:3002/admin/queues`<br/>*(aliases: `/admin`, `/queues`)* | Visual Bull Board UI for email, storage, cleanup queues |
| **Backend Delivery API** | `easystack-dev_backend-delivery` | `3005:3005` | `http://localhost:3005/health` | Express delivery server |
| **BullMQ Queue Workers** | `easystack-dev_backend-workers` | *Internal* | *Logs: `docker logs easystack-dev_backend-workers`* | Runs transactional email & cleanup jobs |
| **MySQL 8.0** | `easystack-mysql` | `3306:3306` | `mysqladmin ping -h localhost` | App: `easystack_app` / `strong-app-password`<br/>Migrate: `easystack_migrate` / `strong-migration-password`<br/>Root: `rootpassword` |
| **MongoDB 7.0** | `easystack-mongodb` | `27017:27017` | `mongosh --eval "db.adminCommand('ping')"` | User: `easystack` / `strong-password` (`authSource=admin`)<br/>Root: `admin` / `admin12345` |
| **Redis 7.2** | `easystack-redis` | `6379:6379` | `redis-cli ping` | Dev DB index: `10`, Prod DB index: `1` |
| **SeaweedFS Filer Dashboard** | `easystack-seaweedfs` | `8888:8888` | `http://localhost:8888/`<br/>`http://localhost:8888/buckets/` | Web File Manager (upload, download, browse buckets) |
| **SeaweedFS Master Dashboard** | `easystack-seaweedfs` | `9333:9333` | `http://localhost:9333/` | Cluster topology, volume assignments, disk status |
| **SeaweedFS S3 Gateway** | `easystack-seaweedfs` | `8333:8333` | `http://localhost:8333` | S3 API endpoint (Key: `admin`, Secret: `admin12345`) |
| **Nginx CDN Proxy** | `easystack-cdn` | `8081:80` | `http://localhost:8081/health` | Routes `/<env>/public/*` to S3 bucket |
| **Jenkins Controller** | `easystack-jenkins` | `8080:8080`<br/>`50000:50000` | `http://localhost:8080/` | Pre-seeded with 3 pipelines:<br/>• `easystack-infra`<br/>• `easystack-backend`<br/>• `easystack-frontend` |
| **Grafana** | `easystack-grafana` | `3001:3000` | `http://localhost:3001/api/health` | User: `admin`, Pass: `admin` |
| **Prometheus** | `easystack-prometheus` | `9090:9090` | `http://localhost:9090/-/healthy` | Metrics scraper across all containers |
| **Loki** | `easystack-loki` | `3100:3100` | `http://localhost:3100/ready` | Central log aggregator |
| **cAdvisor** | `easystack-cadvisor` | `8085:8080` | `http://localhost:8085/metrics` | Container resource monitoring |

---

## 3. Individual Management Commands

### Check All Running Containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Check Shared Infrastructure Status
```bash
cd /home/eteknas/Projects/easystack-backend/infra
docker compose -p easystack-shared -f compose.shared.yaml ps
```

### Check Observability Status
```bash
cd /home/eteknas/Projects/easystack-backend/infra
docker compose -p easystack-observability -f compose.observability.yaml ps
```

### Check Development Application Status
```bash
cd /home/eteknas/Projects/easystack-backend/infra
docker compose -p easystack-dev -f compose.app.yaml --env-file env/.env.dev ps
```

---

## 4. Deploying & Updating Application Environments

### Deploy or Update Development (`dev`)
```bash
cd /home/eteknas/Projects/easystack-backend
./infra/scripts/deploy-app.sh dev
```
*To force a rebuild of the Docker images:*
```bash
./infra/scripts/deploy-app.sh dev --build
```

### Deploy Production (`prod`)
```bash
cd /home/eteknas/Projects/easystack-backend
./infra/scripts/deploy-app.sh prod
```

---

## 5. Provisioning an Arbitrary New Environment On-Demand

You can spin up an arbitrary environment (e.g. `staging`, `qa`, `feature-auth`) on a running stack **without restarting** any containers:

```bash
cd /home/eteknas/Projects/easystack-backend
./infra/scripts/provision-environment.sh staging
```

This script automatically:
1. Creates `easystack_staging` and shadow database in MySQL.
2. Grants DDL/DML permissions to migration and runtime users.
3. Provisions MongoDB database and collections with correct user roles.
4. Creates S3 bucket `easystack-staging` and `/public` folder in SeaweedFS.
5. Emits a ready-to-use `.env.staging` file in `infra/env/`.

Then deploy it:
```bash
./infra/scripts/deploy-app.sh staging
```

---

## 6. Verifying Health of All Services

Run this one-liner to verify all public and internal health probes:

```bash
curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost:3000/ && \
curl -s http://localhost:3002/api/health && echo "" && \
curl -s http://localhost:3005/health && echo "" && \
curl -s http://localhost:8081/health && echo "" && \
curl -s http://localhost:9090/-/healthy && echo "" && \
curl -s http://localhost:3001/api/health && echo ""
```

Expected output:
* Frontend: `200`
* Core API: `{"success":true,"data":{"status":"healthy",...}}`
* Delivery API: `{"status":"healthy","service":"easystack-delivery-api",...}`
* CDN: `{"status":"healthy","service":"easystack-cdn","storage":"seaweedfs"}`
* Prometheus: `Prometheus Server is Healthy.`
* Grafana: `{"commit":...,"database":"ok",...}`

---

## 7. Viewing Logs

```bash
# Backend Core API
docker logs -f easystack-dev_backend-api

# Backend Delivery API
docker logs -f easystack-dev_backend-delivery

# BullMQ Workers
docker logs -f easystack-dev_backend-workers

# Next.js Frontend
docker logs -f easystack-dev_frontend

# SeaweedFS
docker logs -f easystack-seaweedfs

# Jenkins
docker logs -f easystack-jenkins
```

---

## 8. Configuration Files & Secret Manager Integration

### How Configuration is Loaded
In `compose.app.yaml`, all application services (`backend-api`, `backend-delivery`, `backend-workers`, `frontend`) declare:
```yaml
env_file:
  - ${ENV_FILE:-./env/.env.dev}
```
This means:
1. Every key-value pair inside `infra/env/.env.<env>` (e.g. `GOOGLE_AUTH_CLIENT_ID`, `BREVO_API_KEY`, `JWT_SECRET`, database URLs) is **automatically injected** into the containers at runtime.
2. You do not need to manually modify `compose.app.yaml` every time a new environment variable is introduced.
3. Service-specific overrides (like `APP_NAME`, `PORT`, `WORKER_GROUP`) remain in `environment:`.

### Driving via Secret Manager
In production or staging, hardcoding sensitive credentials in `.env` files is not recommended. You can drive secrets via a Secret Manager using two standard patterns:

#### Pattern A: CI/CD Pipeline Injection (Recommended - AWS Secrets Manager / Vault / Infisical / Doppler)
In Jenkins or your CI pipeline, fetch the environment bundle and write `infra/env/.env.<env>` before deployment:
```bash
# Example: Fetching from AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id easystack/production \
  --query SecretString \
  --output text > infra/env/.env.prod

# Deploy with the fetched secrets file
./infra/scripts/deploy-app.sh prod
```

#### Pattern B: Docker Compose Secrets (`secrets:`)
For Docker Swarm or local Docker engines using Docker Secrets:
```yaml
services:
  backend-api:
    secrets:
      - jwt_secret
      - brevo_api_key

secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  brevo_api_key:
    external: true
```
The application reads the secret from `/run/secrets/<secret_name>`.


