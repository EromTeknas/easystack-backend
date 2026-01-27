# Setup Guide - Complete Installation & Configuration

Complete guide for setting up EasyStack Backend for development or production with either MongoDB or MySQL.

---

## Prerequisites

- Node.js v18.x or higher (v24.x recommended)
- npm v9.x or higher
- MongoDB v4.0+ OR MySQL v5.7+ (choose one)
- Git (for version control)

---

## Quick Start (5 Minutes)

```bash
# 1. Clone and install
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your database choice and credentials

# 3. Setup database (follow sections below)
# MongoDB: See "MongoDB Setup" section
# MySQL: See "MySQL Setup" section

# 4. Run migrations
npm run migrate:up

# 5. Start development
npm run dev

# 6. Verify
curl http://localhost:3000/api/health
```

---

## Environment Configuration

Create `.env` file in project root. Use the variables below for your chosen database:

### Application Settings
```env
ENVIRONMENT=local              # local, dev, stage, prod
PORT=3000
LOG_LEVEL=info                # error, warn, info, verbose, debug, silly
LOG_DIR=storage/logs
LOG_IDENTIFIER=easystack

NODE_ENV=development
```

### JWT & Security
```env
JWT_SECRET=your-super-secret-key-min-32-chars-change-this-in-prod
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars-change-this
BCRYPT_ROUNDS=12
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5
```

### Email Configuration (Brevo)
```env
BREVO_API_KEY=your-brevo-api-key-here
BREVO_SENDER_EMAIL=noreply@easystack.io
BREVO_SENDER_NAME=EasyStack
```

### CORS & Security
```env
CORS_ORIGIN=http://localhost:3000   # Frontend URL in prod
COOKIE_SECURE=false                 # Set to true in production (HTTPS only)
```

---

## MongoDB Setup

### 1. Install MongoDB

#### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y mongodb-org
```

Start and enable MongoDB:

```bash
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### macOS (Homebrew)

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### Windows

- Download from: https://www.mongodb.com/try/download/community
- Install MongoDB Server
- Install MongoDB Compass (optional GUI)
- MongoDB runs automatically as Windows Service

### 2. Verify MongoDB is Running

```bash
mongosh
```

Expected output:
```
Connecting to: mongodb://127.0.0.1:27017/
```

Exit shell with `exit`.

### 3. Create Application User

```bash
mongosh
```

Switch to admin database:
```javascript
use admin
```

Create application user:
```javascript
db.createUser({
  user: "easystack",
  pwd: "StrongPassword123!",
  roles: [
    { role: "readWrite", db: "easystack" }
  ]
})
```

Exit with `exit`.

### 4. Enable Authentication

Edit MongoDB config:

```bash
sudo nano /etc/mongod.conf
```

Add security section:
```yaml
security:
  authorization: enabled
```

Restart MongoDB:
```bash
sudo systemctl restart mongod
```

### 5. Configure Environment Variables

Update `.env`:

```env
DATABASE_TYPE=mongodb
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_USER=easystack
MONGO_PASSWORD=StrongPassword123!
MONGO_DATABASE=easystack
```

### 6. URL-Encode Password (if using special characters)

Use JavaScript to encode:
```javascript
encodeURIComponent("Password@123!")
// Result: Password%40123%21
```

Update `.env`:
```env
MONGO_PASSWORD=Password%40123%21
```

### 7. Test Connection

```bash
npm install
npm run migrate:up
```

Check logs for successful connection message.

### MongoDB Security Best Practices

✅ Enable authentication  
✅ Use non-root database users  
✅ Bind MongoDB to localhost only  
✅ Use strong passwords  
✅ Enable TLS/SSL in production  
✅ Regular backups to off-site storage  

---

## MySQL Setup

### 1. Install MySQL

#### Ubuntu / Debian

```bash
sudo apt update
sudo apt install mysql-server -y
```

Verify installation:
```bash
mysql --version
```

#### macOS (Homebrew)

```bash
brew install mysql
brew services start mysql
```

#### Windows

- Download from: https://dev.mysql.com/downloads/mysql/
- Run installer
- Configure as service
- Use MySQL Workbench (optional GUI)

### 2. Start MySQL Service

```bash
sudo systemctl start mysql
sudo systemctl enable mysql    # Enable auto-start
```

### 3. Initial Login (Linux/Mac)

```bash
sudo mysql
```

Or on Windows (open Command Prompt as Administrator):
```bash
mysql -u root -p
```

### 4. Create Application Database

```sql
CREATE DATABASE easystack
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

SHOW DATABASES;
```

### 5. Create Application User

Do NOT use root for applications. Create dedicated user:

```sql
CREATE USER 'easystack'@'localhost' 
  IDENTIFIED BY 'StrongPassword123!';

GRANT ALL PRIVILEGES ON easystack.* 
  TO 'easystack'@'localhost';

FLUSH PRIVILEGES;
```

### 6. Set Authentication Plugin (if needed)

For Node.js compatibility, use `mysql_native_password`:

```sql
ALTER USER 'easystack'@'localhost'
  IDENTIFIED WITH mysql_native_password BY 'StrongPassword123!';

FLUSH PRIVILEGES;
```

### 7. Test Connection as App User

Exit MySQL first:
```sql
EXIT;
```

Test login:
```bash
mysql -u easystack -p -h localhost easystack
```

Enter password when prompted.

### 8. Configure Environment Variables

Update `.env`:

```env
DATABASE_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=easystack
MYSQL_PASSWORD=StrongPassword123!
MYSQL_DATABASE=easystack
```

### 9. Run Migrations

```bash
npm run migrate:up
```

This creates all necessary tables:
- `users`
- `email_otps`
- `refresh_tokens`
- `workspaces`
- `workspace_members`
- `audit_logs`

### Common MySQL Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Access denied | Wrong password | Reset password with `ALTER USER` |
| Connection refused | MySQL not running | `sudo systemctl start mysql` |
| Unknown database | Database not created | Run `CREATE DATABASE` command |
| Plugin error | Wrong auth plugin | Use `mysql_native_password` plugin |

### MySQL Security Best Practices

✅ Do NOT use root for applications  
✅ Create one DB user per application  
✅ Use strong, unique passwords  
✅ Limit user privileges to minimum  
✅ Bind MySQL to localhost only  
✅ Enable TLS/SSL in production  
✅ Regular backups to off-site storage

---

## Environment Modes

Configure `ENVIRONMENT` in `.env`:

| Mode | Use Case | Logging | Error Details |
|------|----------|---------|---------------|
| `local` | Local development | Verbose | Full stack traces |
| `dev` | Dev environment | Debug | Complete details |
| `stage` | Staging/testing | Info | Standard details |
| `prod` | Production | Error/Warn | Minimal (no sensitive info) |

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

## Database Selection

| Aspect | MongoDB | MySQL |
|--------|---------|-------|
| **Install Complexity** | Medium | Medium |
| **Scalability** | Excellent (sharding) | Good (replication) |
| **Schema Flexibility** | High (no schema) | Low (schema required) |
| **ACID Transactions** | Good (4.0+) | Excellent |
| **Query Language** | JavaScript-like | SQL |
| **Recommended For** | Fast-changing schemas | Fixed schemas |

---

## Verification Steps

### 1. Start Development Server

```bash
npm run dev
```

Expected output:
```
🚀 Server running on http://localhost:3000
📚 Swagger docs on http://localhost:3000/docs
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
    "timestamp": "2026-01-28T10:30:45.000Z"
  }
}
```

### 3. Test Authentication

Register a new user:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

Expected response (201 Created):
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "nextStep": "verify-email"
  }
}
```

### 4. Check Logs

```bash
tail -f storage/logs/easystack.log
```

---

## Available Commands

```bash
# Development
npm run dev              # Start with auto-reload (nodemon)

# Build & Production
npm run build            # Compile TypeScript to JavaScript
npm start                # Run compiled code

# Database Migrations
npm run migrate:up       # Run all pending migrations
npm run migrate:down     # Rollback last migration
npm run migrate:fresh    # Reset database (dev only!)
npm run migrate:status   # Show migration status
```

---

## Production Checklist

### Security
- [ ] Change all default passwords
- [ ] Use strong JWT secrets (32+ random characters)
- [ ] Enable HTTPS/TLS
- [ ] Set `COOKIE_SECURE=true`
- [ ] Configure CORS to frontend domain only
- [ ] Enable database authentication
- [ ] Regular database backups
- [ ] Monitor failed login attempts

### Database
- [ ] Enable replication (MySQL) or replica sets (MongoDB)
- [ ] Enable encryption at rest
- [ ] Enable TLS/SSL for database connections
- [ ] Offsite backups
- [ ] Test restore procedures
- [ ] Monitor database performance

### Application
- [ ] Set `ENVIRONMENT=prod`
- [ ] Set `LOG_LEVEL=error` (minimal logging)
- [ ] Enable all error handling
- [ ] Setup monitoring & alerting
- [ ] Configure rate limiting
- [ ] Enable CORS properly
- [ ] Use environment variables for all secrets

### Infrastructure
- [ ] Use Docker containers
- [ ] Use reverse proxy (Nginx)
- [ ] Enable CDN for static assets
- [ ] Configure auto-scaling
- [ ] Setup health checks
- [ ] Enable WAF rules

---

## Troubleshooting

### Database Connection Fails

**MongoDB:**
```bash
# Check if running
sudo systemctl status mongod

# Check credentials
mongosh -u easystack -p --authenticationDatabase admin
```

**MySQL:**
```bash
# Check if running
sudo systemctl status mysql

# Test connection
mysql -u easystack -p -h localhost easystack
```

### Migrations Fail

```bash
# Check status
npm run migrate:status

# Check logs
tail -f storage/logs/easystack.log

# Clear and restart (dev only!)
npm run migrate:fresh
npm run migrate:up
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
echo "PORT=3001" >> .env
```

### Logs Not Generated

```bash
# Check log directory exists
mkdir -p storage/logs

# Check permissions
ls -la storage/logs

# Verify LOG_DIR in .env
```

---

## Next Steps

1. **[Authentication Setup](AUTHENTICATION.md)** - Learn about JWT, OTP, token refresh
2. **[Database Migrations](MIGRATIONS.md)** - Understand schema versioning
3. **[Local Development](LOCAL_DEVELOPMENT.md)** - Development workflow
4. **[Error Handling](ERROR_HANDLING.md)** - Error system documentation
5. **[File Structure](FILE_STRUCTURE.md)** - Project organization

---

## Getting Help

- Check logs: `tail -f storage/logs/easystack.log`
- Check environment: `cat .env`
- Run health check: `curl http://localhost:3000/api/health`
- Review this guide's sections above

---

[← Back to README](../README.md)
