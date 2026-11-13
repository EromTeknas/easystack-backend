# Shared Infrastructure, Docker Containers & Jenkins CI/CD

This document details the shared common infrastructure setup, Docker containerization, and Jenkins CI/CD controller configuration for EasyStack.

---

## 1. Architecture Overview

EasyStack uses a shared infrastructure model hosting stateful data stores, object storage, and CI/CD tools that serve both **Development** and **Production** environments with strict logical database and bucket separation.

```mermaid
graph TB
    subgraph Shared Common Infrastructure [infra/compose.shared.yaml]
        MySQL[(MySQL 8.0 :3306<br/>easystack_dev / easystack_prod)]
        Mongo[(MongoDB 7.0 :27017<br/>easystack_dev / easystack_prod)]
        Redis[(Redis 7 :6379<br/>DB 10 / DB 1)]
        MinIO[(MinIO S3 :9000/:9001<br/>easystack-dev / easystack-prod)]
        CDN[Nginx CDN Proxy :8081<br/>/dev/public/ & /prod/public/]
        Jenkins[Jenkins LTS :8080<br/>Docker Socket Mounted]
    end

    subgraph Observability [infra/compose.observability.yaml]
        Prometheus[Prometheus :9090]
        Grafana[Grafana :3001]
        Loki[Loki :3100]
        Promtail[Promtail]
        cAdvisor[cAdvisor :8085]
    end

    Jenkins -.->|Controls Container Lifecycle| DockerSocket[(/var/run/docker.sock)]
```

---

## 2. Shared Common Services

### A. MySQL 8.0 (`easystack-mysql`)
* **Image**: `mysql:8.0.36`
* **Port**: `3306:3306`
* **Volumes**: `mysql_data:/var/lib/mysql`
* **Initialization Script**: `infra/init-scripts/01-init-mysql.sh`
  * Reads `$ENVIRONMENTS` (comma-separated, default: `dev,staging,prod`).
  * Dynamically creates `easystack_<env>` and `easystack_<env>_shadow` for each environment.
  * Grants DDL privileges to `easystack_migrate` and runtime DML privileges to `easystack_app`.
* **Health Check**: `mysqladmin ping -h localhost`

### B. MongoDB 7.0 (`easystack-mongodb`)
* **Image**: `mongo:7.0.6`
* **Port**: `27017:27017`
* **Volumes**: `mongo_data:/data/db`
* **Initialization Script**: `infra/init-scripts/02-init-mongo.sh`
  * Reads `$ENVIRONMENTS` and dynamically provisions database roles for `easystack` on `easystack_<env>`.
* **Health Check**: `mongosh --eval "db.adminCommand('ping')"`

### C. Redis 7 (`easystack-redis`)
* **Image**: `redis:7.2.4-alpine`
* **Port**: `6379:6379`
* **Volumes**: `redis_data:/data` (AOF persistence enabled)
* **Logical Separation**: Configured per environment via `REDIS_DB` index (e.g. `10` for Dev, `2` for Staging, `1` for Prod) and key namespace prefixes (`easystack:<env>:*`).
* **Health Check**: `redis-cli ping`

### D. MinIO S3 Object Storage & Provisioner (`easystack-minio` & `easystack-minio-init`)
* **Image**: `jumpserver/minio:RELEASE.2024-03-30T09-41-56Z` (stable March 2024 release with full Web Console, access control, and built-in `mc` client)
* **Ports**: `9000:9000` (S3 API), `9001:9001` (Web Console)
* **Volumes**: `minio_data:/data`
* **Credentials**: `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` configured in `infra/.env` (default: `minioadmin` / `minioadmin123`).
* **Provisioner**: Ephemeral container executing `infra/configs/minio/minio-init.sh`:
  * Connects using `mc alias set myminio http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD`.
  * Loops over `$ENVIRONMENTS` and creates `easystack-<env>` buckets (`mc mb --ignore-existing`).
  * Sets anonymous public download policy on `myminio/easystack-<env>/public` (`mc anonymous set download`).
* **Health Check**: TCP socket check on port 9000.

### E. CDN Caching Proxy (`easystack-cdn`)
* **Image**: `nginx:1.25.4-alpine`
* **Port**: `8081:80`
* **Volumes**: `nginx_cache:/var/cache/nginx`
* **Dynamic Regex Routing**: `infra/configs/cdn/nginx.conf`
  * Matches `/<env>/public/<asset>` via regex capture and dynamically routes to `http://minio:9000/easystack-<env>/public/<asset>`.
  * Automatically supports **any** new environment without modifying Nginx configuration.
  * Caches responses in the shared `storage_public` cache zone keyed by `"$env$request_uri"`.
  * `/health` health check endpoint.

### F. Jenkins CI/CD Controller (`easystack-jenkins`)
* **Dockerfile**: `infra/docker/jenkins.Dockerfile` based on `jenkins/jenkins:lts-jdk17`
* **Pre-installed Tooling**: Docker CLI, Docker Compose v2 plugin, Git, jq, curl
* **Integration**: Mounts `/var/run/docker.sock` to control host Docker engine for container builds and deployment rolling updates.
* **Ports**: `8080:8080` (Web UI), `50000:50000` (Agent communication)
* **Volumes**: `jenkins_home:/var/jenkins_home`

---

## 3. Observability Services (`infra/compose.observability.yaml`)

* **Prometheus (`:9090`)**: Scrapes Dev and Prod backend APIs, delivery servers, and container metrics with `{env="dev"}` and `{env="prod"}` labels.
* **Grafana (`:3001`)**: Dashboards pre-provisioned with Prometheus and Loki data sources.
* **Loki (`:3100`) & Promtail**: Collects structured logs from containers and files.
* **cAdvisor (`:8085`)**: Container health and resource metrics.

---

## 4. Operational Commands

> [!IMPORTANT]
> Always use `docker compose` (with a space, Docker Compose v2). Do NOT use legacy `docker-compose` (with a hyphen, Python v1) as modern Docker Engine 26+ inspect schemas will cause it to crash with `KeyError: 'ContainerConfig'`.

### Verify Configurations
```bash
./infra/scripts/verify-shared.sh
```

### Start Shared Infrastructure
```bash
cd infra
docker compose -p easystack-shared -f compose.shared.yaml up -d
```

### Start Observability Stack
```bash
cd infra
docker compose -p easystack-observability -f compose.observability.yaml up -d
```

### Provision an Arbitrary New Environment On-Demand
To dynamically provision MySQL, MongoDB, and MinIO storage for any new environment (e.g. `staging`, `qa`, `feature-123`) without restarting running containers:
```bash
./infra/scripts/provision-environment.sh staging
```

### Inspect Container Health
```bash
docker compose -p easystack-shared -f compose.shared.yaml ps
```

---

## 5. Credential Separation & Multi-Environment Architecture

To prevent credential clobbering, ambiguity, and container sprawl across development, staging, and production environments, EasyStack enforces a strict two-tier configuration model:

1. **Shared Infrastructure Credentials (`infra/.env`)**:
   - Contains cluster root administrator credentials (`MYSQL_ROOT_PASSWORD`, `MONGO_ROOT_USER=admin`, `MONGO_ROOT_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`).
   - Used exclusively by `compose.shared.yaml` and provisioning scripts to manage cluster-wide infrastructure.
   - Never referenced directly by application services or client code.

2. **Application Environment Credentials (`infra/env/.env.<env_name>`)**:
   - Contains environment-scoped database credentials, URIs, and secrets (e.g. `MYSQL_DATABASE=easystack_<env>`, `MYSQL_APP_USER`, `MONGO_URI=mongodb://<app_user>:<pwd>@mongodb:27017/easystack_<env>?authSource=admin`).
   - Used exclusively by `compose.app.yaml` (`backend-api`, `backend-delivery`, `backend-workers`, `frontend`).

### On-Demand Environment Provisioning (e.g. Staging)
When spinning up a new environment like `stage`:
- **NO duplicate database or storage containers are created.** The single running instances of MySQL, MongoDB, Redis, and MinIO are reused.
- Executing `./infra/scripts/provision-environment.sh stage` connects into the running containers and creates:
  - MySQL databases: `easystack_stage` & `easystack_stage_shadow` and grants user permissions.
  - MongoDB database: `easystack_stage` and creates the `easystack_stage` database user.
  - MinIO bucket: `easystack-stage` and public CDN path.
- Executing `./infra/scripts/deploy-app.sh stage` then starts only the stage-specific application containers (`backend-api`, `backend-delivery`, `backend-workers`, `frontend`).


---

## 6. Application Stack Deployment (`infra/compose.app.yaml`)

The application compose stack uses `env_file: [ ${ENV_FILE:-./env/.env.dev} ]` to automatically load all configurations from `infra/env/.env.<env>` into all services (`backend-api`, `backend-delivery`, `backend-workers`, and `frontend`). This eliminates manual duplication in `compose.app.yaml` for third-party credentials (such as Google OAuth and Brevo transactional email) and allows driving configuration seamlessly via a single config file or an external Secret Manager (AWS Secrets Manager, HashiCorp Vault, Infisical, Doppler, or Docker Compose Secrets).

### Deploy Development Application Stack
```bash
./infra/scripts/deploy-app.sh dev
```
Or manually:
```bash
cd infra
docker compose -p easystack-dev -f compose.app.yaml --env-file env/.env.dev up -d
```

### Deploy Production Application Stack
```bash
./infra/scripts/deploy-app.sh prod
```
Or manually:
```bash
cd infra
docker compose -p easystack-prod -f compose.app.yaml --env-file env/.env.prod up -d
```

---

## 7. Background Queue Workers & Bull Board Dashboard

EasyStack utilizes BullMQ queues backed by Redis to decouple asynchronous background jobs from HTTP request-response cycles.

### Registered Queues
1. `translation-queue`: Content entry translation generation via LLM mocks/integrations and MongoDB content entry localization persistence.
2. `email`: Transactional email delivery (OTP, Password Reset, Welcome, Workspace Invites, Release Notifications).
3. `storage-cleanup`: S3 object deletion and reconciliation with MySQL Asset / UploadIntent metadata.
4. `cleanup-queue`: Cascading soft/hard deletion for projects and workspaces.
5. `releases-queue`: Automated cron sweeps evaluating scheduled release deadlines.
6. `scheduled-releases-queue`: Delayed execution jobs for specific scheduled releases.
7. `deployment-releases-queue`: 5-stage sequential deployment pipeline execution.

### Bull Board Monitoring
* **URL**: `http://localhost:3002/admin/queues/`
* **Features**: Live queue metrics, active/delayed/completed/failed job states, manual job retries, and return value inspection. Completed jobs retain up to 100 entries for auditability (`removeOnComplete: 100`).

### Running Workers
* **Docker Container**: `backend-workers` in `infra/compose.app.yaml` runs `npx ts-node src/workers/main.ts all`.
* **Local Development**: `npm run dev` spawns concurrent workers for all queues, or individual workers via `npm run worker:<group>` (`email`, `storage`, `translation`, `cleanup`, `release`).

---

## 8. Central Master Commands Reference
For complete copy-pasteable commands, credentials, port allocations, teardown instructions, and architecture references, see [`infra/SETUP_AND_COMMANDS.md`](../../infra/SETUP_AND_COMMANDS.md).

---

## 9. Jenkins CI/CD Pipelines (`infra/ci/`)

EasyStack provides 3 decoupled Declarative Pipelines:

1. **`infra/ci/Jenkinsfile.infra`**: Deploys/updates shared data stores (MySQL, Mongo, Redis, MinIO, CDN, and Observability).
2. **`infra/ci/Jenkinsfile.backend`**: MultiBranch pipeline for Backend Core API, Delivery API, and Workers. Runs tests, builds the backend image, applies Prisma migrations, rolls out containers, and validates health probes with auto-rollback.
3. **`infra/ci/Jenkinsfile.frontend`**: MultiBranch pipeline for Next.js frontend. Runs linting, compiles standalone image, rolls out frontend container, and verifies HTTP 200 responsiveness.

