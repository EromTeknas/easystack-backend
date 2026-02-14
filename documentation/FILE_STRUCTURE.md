# File Structure

Complete guide to understanding the project folder organization.

---

## Root Level

```
easystack-backend/
├── src/                  # Source code
├── documentation/        # Developer guides
├── storage/             # Application data (logs, uploads)
├── dist/                # Compiled JavaScript (created by npm run build)
├── node_modules/        # Dependencies (created by npm install)
├── .env                 # Environment variables (DO NOT commit)
├── .env.example         # Environment template
├── .gitignore           # Git ignore rules
├── package.json         # Dependencies & scripts
├── tsconfig.json        # TypeScript configuration
├── nodemon.json         # Development auto-reload config
└── README.md            # Main documentation
```

---

## `src/` - Source Code

Main application code, organized by feature and concern.

### Folder Organization

```
src/
├── config/              # Configuration
├── db/                  # Database connections
├── errors/              # Error classes
├── middlewares/         # Express middlewares
├── routes/              # API endpoints
├── utils/               # Utilities
├── context/             # Async storage
├── types/               # TypeScript definitions
├── server.ts            # Application entry
└── logger.ts            # Logger export
```

---

### `src/config/` - Configuration

Handles environment variables and configuration.

```
config/
├── app.ts               # App config (port, env, logging)
├── mongo.ts             # MongoDB URI builder
├── mysql.ts             # MySQL connection config
└── index.ts             # Exports all configs
```

**Purpose**: Validates environment variables using Zod and builds configuration objects.

**Key Files**:
- `app.ts` - Exports `environment`, `port`, `logLevel`, `logDir`, `logIdentifier`
- `mongo.ts` - Builds MongoDB connection string with auto-password encoding
- `mysql.ts` - Builds MySQL connection config

**Example Usage**:
```typescript
import { app, mongo, mysql } from '../config';

console.log(app.port);      // 3000
console.log(mongo.uri);     // mongodb://...
```

---

### `src/db/` - Database Connections

Manages connections to MongoDB and MySQL (via both mysql2 and Prisma ORM).

```
db/
├── mongo.ts             # MongoDB connection & setup
├── mysql.ts             # MySQL pool creation (legacy/raw SQL)
├── prisma.ts            # PrismaClient setup (primary MySQL access)
└── index.ts             # Initialize all databases and re-export clients
```

**Purpose**: Establishes and manages database connections on server startup.

**Key Files**:
- `mongo.ts` - Mongoose connection with error handling
- `mysql.ts` - MySQL2 connection pool with config (used by migration CLI)
- `prisma.ts` - Configures `PrismaClient` using the same MySQL config
- `index.ts` - Called in `server.ts` to connect Mongo, MySQL, and Prisma

**Example Usage**:
```typescript
import { initDatabases } from './db';

await initDatabases();  // Connect to MongoDB and MySQL
```

---

### `src/errors/` - Error Classes

Custom error types for consistent error responses.

```
errors/
├── AppError.ts          # 13 error class definitions
└── index.ts             # Exports all error classes
```

**Error Types**:
1. BadRequestError (400)
2. UnauthorizedError (401)
3. ForbiddenError (403)
4. NotFoundError (404)
5. ConflictError (409)
6. ValidationError (422)
7. TooManyRequestsError (429)
8. InternalServerError (500)
9. NotImplementedError (501)
10. ServiceUnavailableError (503)
11. DatabaseConnectionError (503)
12. DatabaseOperationError (500)

**Example Usage**:
```typescript
import { NotFoundError, BadRequestError } from '../errors';

throw new NotFoundError('User not found', { userId: '123' });
throw new BadRequestError('Email is required');
```

See [Error Handling](ERROR_HANDLING.md) for detailed documentation.

---

### `src/middlewares/` - Express Middlewares

Middleware functions for request processing and error handling.

```
middlewares/
├── request-context.middleware.ts      # Request ID injection
└── error-handler.middleware.ts        # Global error handler
```

**Purpose**: Process requests before/after routes and catch errors.

**request-context.middleware.ts**:
- Generates unique request ID
- Stores in AsyncLocalStorage
- Available throughout request lifecycle
- Injected in logs automatically

**error-handler.middleware.ts**:
- Catches all errors from routes
- Formats error responses
- Logs errors with context
- Handles 404 for undefined routes

**Middleware Order in server.ts**:
```typescript
app.use(requestContextMiddleware);   // First - add request ID
app.use(cors());
app.use(express.json());
app.use('/api', router);             // Routes
app.use(notFoundMiddleware);         // 404 handler
app.use(errorHandlerMiddleware);     // Last - catch errors
```

---

### `src/routes/` - API Endpoints

API endpoints organized by feature.

```
routes/
├── health/
│   └── health.routes.ts             # GET /api/health
├── hello/
│   └── hello.routes.ts              # GET /api/hello
└── index.ts                         # Route aggregator
```

**Organization Pattern**: Each feature gets its own folder:

```
routes/
├── users/
│   └── users.routes.ts              # User endpoints
├── products/
│   └── products.routes.ts           # Product endpoints
├── orders/
│   └── orders.routes.ts             # Order endpoints
└── index.ts
```

**index.ts registers all routes**:
```typescript
router.use('/users', usersRoutes);
router.use('/products', productsRoutes);
router.use('/orders', ordersRoutes);
```

**Route File Example**:
```typescript
// routes/users/users.routes.ts
import { Router } from 'express';

const router = Router();

router.get('/:id', async (req, res) => {
  // GET /api/users/:id
});

router.post('/', async (req, res) => {
  // POST /api/users
});

export default router;
```

---

### `src/utils/` - Utility Functions

Reusable utilities used throughout the application.

```
utils/
├── logger.ts            # Winston logger setup
├── asyncHandler.ts      # Async error wrapper
├── request-context.ts   # Context utilities
└── (other utilities)
```

**logger.ts**:
- Configures Winston logger
- Daily file rotation
- Request ID injection
- Colored console output
- Structured logging

**asyncHandler.ts**:
- Wraps async route handlers
- Catches errors automatically
- Passes to error middleware
- Eliminates need for try-catch

**request-context.ts**:
- Gets request ID from AsyncLocalStorage
- Available in any function during request

**Example Usage**:
```typescript
import logger from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { getRequestId } from '../utils/request-context';

router.get('/', asyncHandler(async (req, res) => {
  const id = getRequestId();
  logger.info('Request received', { requestId: id });
  res.json({ success: true });
}));
```

---

### `src/context/` - Async Local Storage

Manages request-scoped data using AsyncLocalStorage.

```
context/
└── asyncLocal.ts        # AsyncLocalStorage setup
```

**Purpose**: Store request ID that's available throughout request lifecycle without passing as parameter.

**Used By**:
- `request-context.middleware.ts` - Sets request ID
- `utils/request-context.ts` - Retrieves request ID
- `utils/logger.ts` - Injects request ID in logs

---

### `src/types/` - TypeScript Definitions

Type definitions and interfaces.

```
types/
└── express.d.ts         # Express type extensions
```

**Purpose**: Extend Express types with custom properties if needed.

---

## `documentation/` - Developer Guides

```
documentation/
├── SETUP_GUIDE.md           # Installation & configuration
├── LOCAL_DEVELOPMENT.md     # How to develop locally
├── FILE_STRUCTURE.md        # This file
├── ERROR_HANDLING.md        # Error system documentation
├── mongo-db-setup.md        # MongoDB setup instructions
└── my-sql-setup.md          # MySQL setup instructions
```

**How to Navigate**:
- Start with [README](../README.md)
- Setup with [SETUP_GUIDE.md](SETUP_GUIDE.md)
- Understand structure with [FILE_STRUCTURE.md](FILE_STRUCTURE.md)
- Develop with [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
- Handle errors with [ERROR_HANDLING.md](ERROR_HANDLING.md)
- Setup databases with [mongo-db-setup.md](mongo-db-setup.md) and [my-sql-setup.md](my-sql-setup.md)

---

## `storage/` - Application Data

```
storage/
└── logs/                # Application logs
    ├── easystack-2026-01-26.log       # Current day
    ├── easystack-2026-01-25.log.gz    # Previous days (compressed)
    └── ...
```

**Logs**:
- Daily rotation at midnight
- 14-day retention
- Old logs automatically compressed
- Request ID in every entry
- Console output (colored) and file storage

---

## Key Files Explained

### `src/server.ts` - Application Entry Point

```typescript
import express from 'express';
import { requestContextMiddleware } from './middlewares/request-context.middleware';
import router from './routes';
import { errorHandlerMiddleware } from './middlewares/error-handler.middleware';

const app = express();

// Middlewares in order
app.use(requestContextMiddleware);
app.use(express.json());
app.use('/api', router);
app.use(errorHandlerMiddleware);

// Server startup
app.listen(3000, () => {
  console.log('Server running');
});
```

**Execution Order**:
1. Request arrives
2. requestContextMiddleware adds request ID
3. Request routed to `/api/...` handlers
4. If error, errorHandlerMiddleware catches it
5. Response sent

---

### `src/logger.ts` - Logger Export

```typescript
import { getLogger } from './utils/logger';
export default getLogger();
```

Provides singleton logger instance.

---

### `.env` - Environment Variables

Not committed to git. Created by copying `.env.example` and editing:

```env
ENVIRONMENT=local
PORT=3000
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_USER=easystack
MONGO_PASSWORD=qwerty@123
MONGO_DATABASE=easystack
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=easystack
MYSQL_PASSWORD=qwerty@123
MYSQL_DATABASE=easystack
```

---

### `package.json` - Dependencies & Scripts

**Scripts**:
```json
{
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

**Dependencies**:
- express, mongoose, mysql2, winston, zod, cors

**Dev Dependencies**:
- typescript, ts-node, nodemon, @types/*

---

### `tsconfig.json` - TypeScript Configuration

**Key Settings**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

---

## Architecture Summary

```
Request Flow:
  ↓
requestContextMiddleware (adds request ID)
  ↓
Express routes (/api/...)
  ↓
Route Handler (uses asyncHandler)
  ↓
Throw error (if applicable)
  ↓
asyncHandler catches error
  ↓
errorHandlerMiddleware catches & formats
  ↓
Response sent (with request ID)
```

---

## Adding New Feature

To add a new feature (e.g., Users):

1. **Create route file**: `src/routes/users/users.routes.ts`
2. **Register route**: Add to `src/routes/index.ts`
3. **Define errors**: Use existing error classes from `src/errors`
4. **Use asyncHandler**: Wrap async handlers
5. **Add logging**: Use logger from `src/utils/logger`
6. **Deploy**: Run `npm run build` then `npm start`

See [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) for step-by-step guide.

---

## Next Steps

- [Local Development](LOCAL_DEVELOPMENT.md) - Learn how to develop
- [Error Handling](ERROR_HANDLING.md) - Understand error handling
- [Setup Guide](SETUP_GUIDE.md) - Database and environment setup

---

[← Back to README](../README.md)
