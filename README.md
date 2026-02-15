# EasyStack Backend

A production-ready Node.js backend built with Express, TypeScript, and multi-database support (MongoDB and MySQL). Features JWT-based authentication with email verification, comprehensive error handling, and request context tracking.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env

# 3. Configure database (MongoDB or MySQL)
# Edit .env and choose your database

# 4. Run migrations to create tables
npm run migrate:up

# 5. Start development server
npm run dev

# 6. Test the API
curl http://localhost:3000/api/health
curl http://localhost:3000/api/hello
```

---

## 📚 Documentation Index

**See [documentation/INDEX.md](documentation/INDEX.md) for complete documentation guide**

### Core Documentation Files
- **[Setup Guide](documentation/SETUP_GUIDE.md)** - Complete installation & configuration (MongoDB & MySQL)
- **[Authentication](documentation/AUTHENTICATION.md)** - JWT, OTP, tokens, and security (all 7 endpoints)
- **[Error Handling](documentation/ERROR_HANDLING.md)** - Error system with 13 error types
- **[Database Migrations](documentation/MIGRATIONS.md)** - Schema versioning (6 migrations)
- **[File Structure](documentation/FILE_STRUCTURE.md)** - Project organization and code location
- **[Local Development](documentation/LOCAL_DEVELOPMENT.md)** - Development workflow
- **[Implementation Summary](documentation/IMPLEMENTATION_SUMMARY.md)** - What's been built

### API References
- **[OpenAPI 3.0 Specification](openapi.json)** - Swagger/ReDoc compatible
- **[Postman Collection](EasyStack-Backend-API.postman_collection.json)** - Ready-to-import for testing

---

## ✨ Key Features

✅ **Authentication System**
- User registration with email verification (6-digit OTP)
- Login with email/password (requires verified email)
- Refresh token rotation with 7-day expiry
- Access token with 15-minute expiry
- Automatic 401 → refresh → retry on frontend

✅ **Database Flexibility**
- Multi-database support (MongoDB & MySQL)
- Automatic schema setup via migrations
- Connection pooling and error handling

✅ **Error Handling**
- 13 custom error types with consistent responses
- Automatic request ID generation for tracing
- Winston logger with daily file rotation
- Detailed error context and debugging info

✅ **Security**
- Password hashing with bcrypt (12 rounds)
- JWT signing with HS256
- Refresh token hashing before storage
- Rate limiting on auth endpoints (5 attempts per 15 minutes)
- CORS and helmet security headers
- Input validation on all endpoints

✅ **Middleware Stack**
- Authentication middleware (Bearer token validation)
- Authorization middleware (role-based access control)
- Error handling middleware (centralized error processing)
- Request context middleware (unique request ID tracking)
- Rate limiting middleware (endpoint protection)

✅ **Development Experience**
- Full TypeScript with strict mode
- Auto-reload with nodemon
- Environment-based configuration (local, dev, stage, prod)
- Comprehensive logging with Winston
- Request context tracking

---

## 🎯 Project Overview

### Technology Stack
- **Runtime**: Node.js v24.x
- **Language**: TypeScript
- **Framework**: Express.js 5.2.1
- **Databases**: MongoDB 2.6.0 & MySQL 8.0.44
- **Authentication**: JWT (jsonwebtoken) + bcrypt
- **Logging**: Winston
- **Email**: Brevo (for OTP delivery)

### Folder Structure
```
src/
├── config/           Configuration & validation
├── db/              Database connections (mongo, mysql)
├── errors/          Custom error classes (13 types)
├── middlewares/     Authentication, authorization, error handling
├── routes/          API endpoints (auth, health, hello)
│   └── auth/        Registration, login, verification, etc.
├── services/        Business logic (email, workspace)
├── types/           TypeScript definitions
├── utils/           JWT, password, OTP, validation
├── migrations/      Database schema (5 migrations)
├── cli/             CLI commands (migrate)
└── server.ts        Application entry point
```

### Current API Endpoints

**Authentication** (all protected by rate limiting):
- `POST /api/auth/register` - Create account, send OTP
- `POST /api/auth/verify-email` - Verify email with OTP, get access token
- `POST /api/auth/resend-otp` - Resend OTP code
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Get new access token
- `POST /api/auth/logout` - Revoke refresh token
- `GET /api/auth/me` - Get current user profile

**Health & Status**:
- `GET /api/health` - Health check with status
- `GET /api/hello` - Hello world greeting

### Database Migrations
- **001-create-users** - User accounts with email verification status
- **002-create-refresh-tokens** - JWT refresh token storage with rotation support
- **002-create-workspaces** - Multi-workspace support
- **003-create-audit-logs** - Action tracking for compliance
- **003-create-workspace-members** - Workspace access control and roles
- **004-create-email-otps** - Email verification OTP storage (10-min expiry)

---

## 🔧 Available Commands

```bash
# Development
npm run dev              # Start with auto-reload (nodemon)

# Build & Production
npm run build            # Compile TypeScript to JavaScript
npm start                # Run compiled code

# Prisma & Database Migrations
npm run prisma:migrate   # Run Prisma migrations (dev)
npm run prisma:generate  # Regenerate Prisma client after schema changes
```

---

## 📖 Getting Started

### 1. Initial Setup
Follow [Setup Guide](documentation/SETUP_GUIDE.md) to:
- Install dependencies
- Configure `.env` file
- Choose and setup your database (MongoDB or MySQL)
- Run migrations

### 2. Understand the Project
- **New to the project?** Read [File Structure](documentation/FILE_STRUCTURE.md)
- **How do errors work?** Check [Error Handling](documentation/ERROR_HANDLING.md)
- **Implementing auth?** See [Authentication](documentation/AUTHENTICATION.md)
- **Database questions?** See [Database Migrations](documentation/MIGRATIONS.md)

### 3. Development Workflow
- Start dev server: `npm run dev`
- Make changes in `src/`
- Test with [Postman Collection](EasyStack-Backend-API.postman_collection.json)
- Check logs in `storage/logs/`

### 4. Deploy to Production
- Run `npm run build` to compile
- Setup environment variables for prod
- Apply Prisma migrations using your deployment process (e.g. `prisma migrate deploy`)
- Start with `npm start`

---

## 🏗️ Project Philosophy

This project is organized with these principles:

1. **Topic-Based Documentation**: All information about one topic (authentication, migrations, errors) is in ONE file
2. **Self-Contained Features**: Each feature folder includes all related code (routes, controllers, services)
3. **Environment-Based Config**: All configuration comes from environment variables
4. **Explicit Error Handling**: Custom error types for every scenario
5. **Type Safety**: Full TypeScript with strict mode
6. **Logging & Tracing**: Every request has a unique ID for debugging

---

## 📞 Support

For issues or questions:
1. Check the relevant documentation file
2. Search in [Authentication](documentation/AUTHENTICATION.md) for auth issues
3. Search in [Error Handling](documentation/ERROR_HANDLING.md) for error details
4. Search in [Database Migrations](documentation/MIGRATIONS.md) for schema questions

---

## License

ISC
