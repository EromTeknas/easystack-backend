# EasyStack Backend

A production-ready Node.js backend built with Express, TypeScript, and multi-database support (MongoDB and MySQL).

## 🚀 Quick Start

```bash
# Install and setup
npm install
cp .env.example .env

# Setup database (creates all tables)
npm run migrate:up

# Start development server
npm run dev

# Test the API
curl http://localhost:3000/api/health
curl http://localhost:3000/api/hello
```

---

## 📚 Documentation

**Getting Started**:
- [Setup Guide](documentation/SETUP_GUIDE.md) - Environment configuration and database setup
- [Local Development](documentation/LOCAL_DEVELOPMENT.md) - Running and developing locally
- [Database Migrations](documentation/MIGRATIONS.md) - Schema versioning and management

**Understanding the Project**:
- [File Structure](documentation/FILE_STRUCTURE.md) - Folder organization and purpose
- [Error Handling](documentation/ERROR_HANDLING.md) - Error system (13 error types, patterns, usage)
- [Authentication System](documentation/AUTHENTICATION.md) - JWT-based authentication with refresh tokens
- [Authentication Quick Start](documentation/AUTHENTICATION_QUICK_START.md) - Quick reference for using auth APIs

**Database Setup**:
- [MongoDB Setup](documentation/mongo-db-setup.md) - Installation and configuration
- [MySQL Setup](documentation/my-sql-setup.md) - Installation and configuration

---

## ✨ Key Features

- **Multi-Database Support**: MongoDB and MySQL with automatic password encoding
- **Request Context Tracking**: Unique request ID for every request, logged automatically
- **Comprehensive Error Handling**: 13 custom error types with consistent responses
- **Feature-Based Routes**: Organized by functionality, easy to extend
- **Request Logging**: Winston logger with daily file rotation
- **Environment Management**: local, dev, stage, prod support
- **Full TypeScript**: Type-safe codebase with strict mode

---

## 🎯 Project Overview

### Stack
- **Runtime**: Node.js v24.x with TypeScript
- **Framework**: Express.js 5.2.1
- **Databases**: MongoDB 2.6.0 (mongosh) & MySQL 8.0.44

### Architecture
```
src/
├── config/       - Configuration & validation
├── db/          - Database connections
├── errors/      - Custom error classes
├── middlewares/ - Request context & error handling
├── routes/      - API endpoints (feature-based)
├── utils/       - Reusable utilities & logging
└── server.ts    - Application entry point
```

### API Endpoints
- `GET /api/health` - Health check (status, timestamp)
- `GET /api/hello` - Hello world (message, timestamp)

### Error Handling
- BadRequest (400), Unauthorized (401), Forbidden (403)
- NotFound (404), Conflict (409), ValidationError (422)
- TooManyRequests (429), InternalServerError (500)
- NotImplemented (501), ServiceUnavailable (503)
- DatabaseConnectionError, DatabaseOperationError (503/500)

---

## 🔧 Available Commands

```bash
npm run dev        # Development with auto-reload (nodemon)
npm run build      # Compile TypeScript
npm start          # Run compiled code (production)
```

---

## 📖 Next Steps

1. **Setup**: Follow [Setup Guide](documentation/SETUP_GUIDE.md)
2. **Understand**: Read [File Structure](documentation/FILE_STRUCTURE.md)
3. **Develop**: Check [Local Development](documentation/LOCAL_DEVELOPMENT.md)
4. **Errors**: Learn [Error Handling](documentation/ERROR_HANDLING.md)

---

## License

ISC
