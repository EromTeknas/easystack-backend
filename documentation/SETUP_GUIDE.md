# Setup Guide

Complete guide for setting up EasyStack Backend for development or production.

## Prerequisites

- Node.js v18.x or higher (v24.x recommended)
- npm v9.x or higher
- MongoDB v4.0 or higher
- MySQL v5.7 or higher

---

## Installation

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example file:
```bash
cp .env.example .env
```

### 3. Edit `.env`

Update with your database credentials:

```env
# Application
ENVIRONMENT=local                  # local, dev, stage, prod
PORT=3000
LOG_LEVEL=info                    # error, warn, info, verbose, debug, silly
LOG_DIR=storage/logs
LOG_IDENTIFIER=easystack

# MongoDB
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_USER=easystack
MONGO_PASSWORD=qwerty@123         # Special chars auto-encoded
MONGO_DATABASE=easystack

# MySQL
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=easystack
MYSQL_PASSWORD=qwerty@123
MYSQL_DATABASE=easystack
```

### 4. Setup Databases

- **MongoDB**: Follow [mongo-db-setup.md](mongo-db-setup.md)
- **MySQL**: Follow [my-sql-setup.md](my-sql-setup.md)

---

## Environment Modes

Configure `ENVIRONMENT` in `.env`:

| Mode | Use Case | Logging | Error Details |
|------|----------|---------|---------------|
| `local` | Local development | Verbose | Full stack traces |
| `dev` | Development environment | Debug | Complete details |
| `stage` | Staging/testing | Info | Standard details |
| `prod` | Production | Error/Warn only | Minimal (no sensitive info) |

---

## Log Levels

Set `LOG_LEVEL` in `.env`:

- `error` - Only errors
- `warn` - Errors and warnings
- `info` - Standard logging (default)
- `verbose` - Detailed information
- `debug` - Debugging information
- `silly` - Everything (very verbose)

---

## Verification

After setup, verify everything works:

### 1. Start Development Server
```bash
npm run dev
```

### 2. Test Health Endpoint
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-26T10:30:45.123Z"
  }
}
```

### 3. Test Hello Endpoint
```bash
curl http://localhost:3000/api/hello
```

Expected response:
```json
{
  "success": true,
  "data": {
    "message": "Hello, World!",
    "timestamp": "2026-01-26T10:30:45.123Z"
  }
}
```

### 4. Check Logs
Logs are in `storage/logs/`:
```bash
tail -f storage/logs/easystack-*.log
```

Should show server startup and request logs with request IDs.

---

## Production Build

### Compile TypeScript
```bash
npm run build
```

This creates `dist/` folder with compiled JavaScript.

### Run Production
```bash
npm start
```

Runs from `dist/server.js`.

---

## Troubleshooting

### MongoDB Connection Timeout
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solutions**:
1. Verify MongoDB is running: `mongosh --version`
2. Check MONGO_HOST and MONGO_PORT in `.env`
3. See [mongo-db-setup.md](mongo-db-setup.md)

### MySQL Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Solutions**:
1. Verify MySQL is running: `mysql --version`
2. Check MYSQL_HOST, MYSQL_PORT, credentials in `.env`
3. See [my-sql-setup.md](my-sql-setup.md)

### Port Already in Use
```
Error: listen EADDRINUSE :::3000
```

**Solution**: Change PORT in `.env`:
```env
PORT=3001
```

### TypeScript Compilation Error
```
error TS2322: Type 'X' is not assignable to type 'Y'
```

**Solution**:
```bash
npm run build    # See detailed errors
npm install      # Reinstall if needed
```

---

## Next Steps

- [Local Development](LOCAL_DEVELOPMENT.md) - How to develop locally
- [File Structure](FILE_STRUCTURE.md) - Understand the project layout
- [Error Handling](ERROR_HANDLING.md) - How error handling works

---

[← Back to README](../README.md)
