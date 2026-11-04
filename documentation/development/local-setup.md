# Local Environment Setup Guide

## 1. Prerequisites

Before starting, ensure you have the following installed on your development workstation:

- **Node.js**: v20.x or higher (v24.x recommended)
- **npm**: v9.x or higher
- **MySQL**: v8.0+ (running on port `3306`)
- **MongoDB**: v6.0+ or v7.0+ (running on port `27017`)
- **Redis**: v7.0+ (running on port `6379`)
- **Docker & Docker Compose**: (Optional, for local MinIO S3 object storage emulation)

---

## 2. Quick Start (5-Minute Bootstrap)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy the template configuration into `.env`:
```bash
cp .env.example .env
```

Ensure the database connection strings in `.env` match your local instances:
```env
# Application
PORT=3000
ENVIRONMENT=local
LOG_LEVEL=info

# MySQL (Prisma)
DATABASE_URL=mysql://root:password@localhost:3306/easystack
SHADOW_DATABASE_URL=mysql://root:password@localhost:3306/easystack_shadow

# MongoDB (Mongoose)
MONGODB_URI=mongodb://localhost:27017/easystack

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0

# Object Storage (Local MinIO default)
STORAGE_S3_BUCKET=easystack
STORAGE_S3_REGION=us-east-1
STORAGE_S3_INTERNAL_ENDPOINT=http://localhost:9000
STORAGE_S3_PUBLIC_ENDPOINT=http://localhost:9000
STORAGE_S3_ACCESS_KEY_ID=easystack
STORAGE_S3_SECRET_ACCESS_KEY=easystack-secret
STORAGE_CDN_BASE_URL=http://localhost:8081
```

### Step 3: Start Local Object Storage (MinIO + NGINX)
Run the pre-configured Docker Compose stack located in [`infra/storage/`](file:///home/eteknas/Projects/easystack-backend/infra/storage):
```bash
docker compose -f infra/storage/docker-compose.yml up -d
```
This boots:
- MinIO S3 API on port `9000`
- MinIO Web Console on port `9001`
- NGINX CDN Simulator on port `8081`

### Step 4: Run Database Migrations
Apply all Prisma schema migrations to your local MySQL database:
```bash
npm run prisma:migrate
```

### Step 5: Seed the Database
Seed roles, permissions, billing plans, quotas, and test users:
```bash
npm run db:seed:users
```

### Step 6: Start the Development Server
```bash
npm run dev
```

### Step 7: Verify Installation
Open a new terminal and verify the health check:
```bash
curl http://localhost:3000/api/health
```
Expected output:
```json
{
  "status": "healthy",
  "timestamp": "2026-11-04T12:00:00.000Z",
  "databases": {
    "mysql": "connected",
    "mongo": "connected",
    "redis": "connected"
  }
}
```
Open the Bull-board queue dashboard in your browser:
`http://localhost:3000/admin/queues`
