# Documentation Index

Complete guide to EasyStack Backend documentation. All related information is consolidated into single, comprehensive files.

---

## 📚 Core Documentation

### [AUTHENTICATION.md](AUTHENTICATION.md) - JWT, OTP & Security (36 KB)

Complete authentication system with everything you need:
- ✅ Email + password registration with OTP verification
- ✅ JWT access tokens (15-minute expiry)
- ✅ Refresh token rotation (7-day expiry)  
- ✅ Password hashing with bcrypt
- ✅ Rate limiting on auth endpoints
- ✅ All 7 API endpoints documented
- ✅ Token flow diagrams
- ✅ Security implementation details
- ✅ Frontend integration examples
- ✅ Testing strategies
- ✅ Troubleshooting guide

**When to read:** Implementing authentication, understanding token flows, securing your auth endpoints.

---

### [SETUP_GUIDE.md](SETUP_GUIDE.md) - Installation & Configuration (12 KB)

Complete setup instructions for both databases:
- ✅ Quick start (5 minutes)
- ✅ MongoDB installation & setup
- ✅ MySQL installation & setup
- ✅ Environment configuration
- ✅ Database user creation
- ✅ Authentication setup
- ✅ Connection testing
- ✅ Production checklist
- ✅ Troubleshooting by database type
- ✅ All npm scripts explained

**When to read:** Setting up development environment, configuring databases, production deployment.

---

### [MIGRATIONS.md](MIGRATIONS.md) - Database Schema Versioning (12 KB)

Complete migrations system documentation:
- ✅ Why migrations matter
- ✅ Quick start commands
- ✅ Migration commands (up, down, fresh, status)
- ✅ How migrations work
- ✅ All 5 current migrations detailed
- ✅ Creating new migrations
- ✅ Database schema (tables, fields, indexes)
- ✅ Troubleshooting migration issues
- ✅ Best practices
- ✅ Track what changed when

**When to read:** Understanding database schema, creating migrations, running migrations in production.

---

### [ERROR_HANDLING.md](ERROR_HANDLING.md) - Error System (17 KB)

Complete error handling guide:
- ✅ 13 custom error types
- ✅ Error structure and response format
- ✅ HTTP status code mapping
- ✅ How to use errors in code
- ✅ Error messages and codes
- ✅ Stack traces and debugging
- ✅ Logging with error context
- ✅ Frontend error handling
- ✅ Production error handling
- ✅ Examples for each error type

**When to read:** Understanding error responses, handling errors in code, debugging issues.

---

### [FILE_STRUCTURE.md](FILE_STRUCTURE.md) - Project Organization (12 KB)

Complete project folder organization:
- ✅ Folder purpose explanation
- ✅ File organization patterns
- ✅ Where to add new features
- ✅ Middleware location and purpose
- ✅ Routes organization
- ✅ Services and utilities
- ✅ Configuration system
- ✅ Database adapters
- ✅ Migration system files
- ✅ Import path guidelines

**When to read:** Understanding project layout, adding new features, finding where to put code.

---

## 🛠️ Development

### [CONFIGURATION.md](CONFIGURATION.md) - Environment & Runtime Configuration

Centralized validated configuration, CORS, storage/S3 compatibility, and rules for adding new environment settings.

**When to read:** Adding an environment variable, changing CORS, configuring storage, or removing direct `process.env` access.

### [STORAGE_SERVICE.md](STORAGE_SERVICE.md) - Object Storage & Uploads

Intent-based storage service documentation:
- ✅ Direct browser uploads using presigned POSTs
- ✅ Public CDN and authorized private URL resolution
- ✅ Single and multiple asset targets
- ✅ Safe replacement, deletion, retries, and reconciliation
- ✅ MinIO, NGINX, Redis, Prisma, and worker setup
- ✅ Domain-service and browser integration examples
- ✅ Failure cases, security rules, and production checklist

**When to read:** Adding avatars, logos, covers, attachments, or any new file-backed domain feature.

### [STORAGE_INTENT_LIFECYCLE.md](STORAGE_INTENT_LIFECYCLE.md) - Upload Intent Cleanup

Simple guide to upload-intent states and the reconciliation, object-deletion, and retention jobs.

**When to read:** Understanding expired uploads, investigating cleanup jobs, or operating storage workers.

### [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) - Development Workflow (7.8 KB)

Developer setup and workflow:
- ✅ Running development server
- ✅ Auto-reload with nodemon
- ✅ Database seeding for testing
- ✅ Test data creation
- ✅ Development tips and tricks
- ✅ Hot reload configuration
- ✅ Debugging with VS Code
- ✅ Common development issues
- ✅ Environment switching

**When to read:** Starting local development, running the project, debugging issues.

---

### [WORKERS.md](WORKERS.md) - Background Jobs & Queues

Centralized standalone BullMQ processing:
- ✅ Shared mechanics under `src/infrastructure/queue`
- ✅ Service-owned contracts, producers, and processors
- ✅ Independently runnable email and storage worker groups
- ✅ Shared queue and worker lifecycle abstractions
- ✅ Graceful shutdown, logging, retries, and retention
- ✅ Deployment and independent scaling patterns

**When to read:** Configuring and operating background workers, scaling email/OTP throughput.

### [QUEUE_AND_WORKER_USAGE.md](QUEUE_AND_WORKER_USAGE.md) - Practical Queue Usage

Simple examples showing which producers to import, required parameters, processor creation, worker registration, schedules, and common mistakes.

**When to read:** Enqueueing an existing job or adding a new background job and worker group.

---

### [BILLING.md](BILLING.md) - Plans, Pricing & Usage Tracking (NEW)

Complete billing and subscription system:
- ✅ JSON-based flexible plan configuration
- ✅ Per-user custom overrides for enterprise
- ✅ Real-time usage tracking in MongoDB
- ✅ Redis caching for performance
- ✅ Billing guards and middleware
- ✅ Admin APIs for plan management
- ✅ Plan versioning and history
- ✅ Feature flags and quota enforcement
- ✅ Default plan seeding
- ✅ Integration examples

**When to read:** Implementing billing, understanding plans/subscriptions, adding usage tracking.

---

## 📖 Reference

### [FILES_REFERENCE.md](FILES_REFERENCE.md) - Detailed File Listing (11 KB)

Detailed reference of all source files:
- ✅ Every file in `src/` described
- ✅ Purpose of each file
- ✅ Key exports and functions
- ✅ Dependencies between files
- ✅ Configuration files
- ✅ Migration files
- ✅ Entry points

**When to read:** Understanding specific files, finding where code is located, code navigation.

---

### [REDIS_SETUP.md](REDIS_SETUP.md) - Redis & Caching (new)

Redis usage and setup:
- ✅ Local Redis installation & basic commands
- ✅ Environment variables (`REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`)
- ✅ How OTPs and reset tokens are stored
- ✅ How BullMQ queues use Redis
- ✅ Troubleshooting connection issues

**When to read:** Setting up Redis, debugging Redis/BullMQ issues.

---

### [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - What Was Built (16 KB)

Summary of complete implementation:
- ✅ Authentication system overview
- ✅ All 7 auth endpoints
- ✅ Migration system
- ✅ Error handling
- ✅ Middleware stack
- ✅ Routes and controllers
- ✅ Services
- ✅ Database adapters
- ✅ Next steps and enhancements

**When to read:** Understanding what's implemented, planning next features, project overview.

---

## 🔄 Deprecated Documentation

See [_deprecated/README.md](_deprecated/README.md) for files that have been consolidated.

**Old files moved to `_deprecated/`:**
- AUTHENTICATION_QUICK_START.md → Merged into AUTHENTICATION.md
- AUTHENTICATION_ADVANCED.md → Merged into AUTHENTICATION.md
- AUTH_QUICK_REFERENCE.md → Merged into AUTHENTICATION.md
- AUTH_SETUP.md → Merged into AUTHENTICATION.md
- mongo-db-setup.md → Merged into SETUP_GUIDE.md
- my-sql-setup.md → Merged into SETUP_GUIDE.md
- MIGRATIONS_SETUP.md → Merged into MIGRATIONS.md

---

## 🎯 Quick Navigation by Task

### I want to...

**Set up development environment**
→ [SETUP_GUIDE.md](SETUP_GUIDE.md)

**Understand authentication flow**
→ [AUTHENTICATION.md](AUTHENTICATION.md)

**Understand error responses**
→ [ERROR_HANDLING.md](ERROR_HANDLING.md)

**Understand project structure**
→ [FILE_STRUCTURE.md](FILE_STRUCTURE.md)

**Implement a new feature**
→ [FILE_STRUCTURE.md](FILE_STRUCTURE.md) + [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)

**Create a database migration**
→ [MIGRATIONS.md](MIGRATIONS.md)

**Debug a problem**
→ [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) + [ERROR_HANDLING.md](ERROR_HANDLING.md)

**Deploy to production**
→ [SETUP_GUIDE.md](SETUP_GUIDE.md) (Production Checklist)

**Understand what was built**
→ [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

**Set up billing and plans**
→ [BILLING.md](BILLING.md)

**Add usage tracking to routes**
→ [BILLING.md](BILLING.md)

---

## 📋 Quick Reference

### All API Endpoints (7 total)

**Authentication Endpoints:**
```
POST   /api/auth/register       - Create account, send OTP
POST   /api/auth/verify-email   - Verify OTP, get tokens
POST   /api/auth/resend-otp     - Resend OTP code
POST   /api/auth/login          - Login with password
POST   /api/auth/refresh        - Get new access token
POST   /api/auth/logout         - Revoke tokens
GET    /api/auth/me             - Get current user
```

**Billing Endpoints:**
```
GET    /api/billing/plans       - Get all available plans (public)
GET    /api/billing/my-plan     - Get current user's plan & usage

GET    /api/admin/billing/plans                      - Get all plans (internal admin dashboard)
POST   /api/admin/billing/plans                      - Create plan (internal admin dashboard)
PUT    /api/admin/billing/plans/:id                  - Update plan (internal admin dashboard)
GET    /api/admin/billing/subscriptions/:userId      - Get user subscription (internal admin dashboard)
PATCH  /api/admin/billing/subscriptions/:userId      - Update subscription (internal admin dashboard)
PATCH  /api/admin/billing/subscriptions/:userId/override - Set custom override (internal admin dashboard)
```

**Health Endpoints:**
```
GET    /api/health              - Health check
GET    /api/hello               - Hello world
```

See [AUTHENTICATION.md](AUTHENTICATION.md) and [BILLING.md](BILLING.md) for full details.

---

### Database Migrations (6 total)

1. **001-create-users** - User accounts with email verification
2. **002-create-refresh-tokens** - JWT token storage and revocation
3. **002-create-workspaces** - Multi-workspace support
4. **003-create-audit-logs** - Action tracking
5. **003-create-workspace-members** - Workspace access control
6. **004-create-email-otps** - OTP verification storage

See [MIGRATIONS.md](MIGRATIONS.md) for full schema details.

---

### Error Types (13 total)

```
ValidationError      - Input validation failed
UnauthorizedError    - No/invalid authentication
ForbiddenError       - Insufficient permissions
NotFoundError        - Resource not found
ConflictError        - Resource already exists
RateLimitError       - Too many requests
InternalError        - Server error
ServiceError         - External service failed
...and more
```

See [ERROR_HANDLING.md](ERROR_HANDLING.md) for complete list.

---

### Commands

```bash
# Development
npm run dev              # Start with auto-reload

# Build
npm run build            # Compile TypeScript
npm start                # Run production

# Prisma & Migrations
npm run prisma:migrate   # Run Prisma migrations (dev)
npm run prisma:generate  # Regenerate Prisma client after schema changes
```

---

## 🎓 Reading Order

For new developers:

1. [README](../README.md) - Project overview
2. [SETUP_GUIDE.md](SETUP_GUIDE.md) - Get development environment running
3. [FILE_STRUCTURE.md](FILE_STRUCTURE.md) - Understand project organization
4. [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) - Learn development workflow
5. [AUTHENTICATION.md](AUTHENTICATION.md) - Understand auth system
6. [ERROR_HANDLING.md](ERROR_HANDLING.md) - Understand error handling
7. [MIGRATIONS.md](MIGRATIONS.md) - Learn about database changes
8. [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - See what's possible

---

## 📞 Getting Help

- **Setup issues?** → [SETUP_GUIDE.md](SETUP_GUIDE.md#troubleshooting)
- **Auth questions?** → [AUTHENTICATION.md](AUTHENTICATION.md)
- **Error debugging?** → [ERROR_HANDLING.md](ERROR_HANDLING.md)
- **Where is code?** → [FILE_STRUCTURE.md](FILE_STRUCTURE.md)
- **How to add features?** → [FILE_STRUCTURE.md](FILE_STRUCTURE.md) + [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)

---

[← Back to README](../README.md)
