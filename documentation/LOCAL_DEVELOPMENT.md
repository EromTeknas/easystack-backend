# Local Development

Guide for developing features locally.

---

## Running Locally

### Development Mode (Auto-Reload)
```bash
npm run dev
```

- Runs with nodemon (auto-restart on file changes)
- Full debug logging
- TypeScript with ts-node

Server starts on port 3000 (or `PORT` from `.env`).

---

## Project Structure for Development

```
src/
├── routes/           # Add new endpoints here
│   ├── health/
│   ├── hello/
│   └── (your features)
│
├── errors/           # Custom error classes (ready to use)
├── middlewares/      # Request context, error handling
├── utils/            # Logging, asyncHandler
├── db/              # Database connections
└── config/          # Environment configuration
```

See [File Structure](FILE_STRUCTURE.md) for detailed explanation.

---

## Adding New Endpoints

### Step 1: Create Route File

Create file `src/routes/users/users.routes.ts`:

```typescript
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError, BadRequestError } from '../../errors';

const router = Router();

// GET /api/users/:id
router.get('/:id', asyncHandler(async (req, res) => {
  if (!req.params.id) {
    throw new BadRequestError('User ID required');
  }
  
  // Your logic here
  const user = { id: req.params.id, name: 'John' };
  
  res.json({ success: true, data: user });
}));

// POST /api/users
router.post('/', asyncHandler(async (req, res) => {
  const user = { id: '1', ...req.body };
  res.status(201).json({ success: true, data: user });
}));

export default router;
```

### Step 2: Register Route

Edit `src/routes/index.ts`:

```typescript
import { Router } from 'express';
import healthRoutes from './health/health.routes';
import helloRoutes from './hello/hello.routes';
import usersRoutes from './users/users.routes';  // Add this

const router = Router();

router.use('/health', healthRoutes);
router.use('/hello', helloRoutes);
router.use('/users', usersRoutes);  // Add this

export default router;
```

### Result

Your endpoints are available at:
- `GET /api/users/:id`
- `POST /api/users`

---

## Error Handling

### Using asyncHandler

All async route handlers should use `asyncHandler`. It automatically catches errors:

```typescript
import { asyncHandler } from '../utils/asyncHandler';

router.get('/users/:id', asyncHandler(async (req, res) => {
  // Any error thrown is caught automatically
  // No try-catch needed!
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  res.json({ success: true, data: user });
}));
```

### Throwing Errors

Use appropriate error classes from `src/errors`:

```typescript
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  InternalServerError
} from '../errors';

// Validation error
throw new BadRequestError('Email is required');

// Not found
throw new NotFoundError('User not found', { userId });

// Conflict (e.g., duplicate email)
throw new ConflictError('Email already exists');

// Unauthorized
throw new UnauthorizedError('Invalid credentials');

// Forbidden
throw new ForbiddenError('You do not have permission');

// Validation logic error
throw new ValidationError('Age must be 18 or older');

// Unexpected error
throw new InternalServerError('Something went wrong');
```

See [Error Handling](ERROR_HANDLING.md) for all 13 error types.

---

## Logging

### Basic Logging

```typescript
import logger from '../utils/logger';

// Info
logger.info('User created', { userId: '123', email: 'john@example.com' });

// Warning
logger.warn('Slow database query', { duration: 5000 });

// Error
logger.error('Database connection failed', { code: 'ECONNREFUSED' });

// Debug
logger.debug('Request body', { body: req.body });
```

### Request Context

Every request has a unique ID automatically added to logs:

```typescript
import { getRequestId } from '../utils/request-context';

router.get('/trace', (req, res) => {
  const requestId = getRequestId();
  logger.info('Processing request', { requestId });
  res.json({ requestId });
});
```

Log output will show:
```
[req:abc123] User created
```

Same request ID is in all logs for that request, making it easy to trace.

---

## Building TypeScript

Check for type errors without running:
```bash
npm run build
```

If successful, compiles to `dist/` folder.

---

## Testing Endpoints

### Using curl

```bash
# GET request
curl http://localhost:3000/api/users/123

# POST request with JSON
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com"}'

# With authentication header
curl -H "Authorization: Bearer token" http://localhost:3000/api/users
```

### Using Postman

1. Import `easystack-backend/openapi.json` into Postman
2. Or manually create requests matching your endpoints

---

## Debugging

### View Recent Logs
```bash
tail -f storage/logs/easystack-*.log
```

### Check TypeScript Errors
```bash
npm run build
```

Shows all type errors without creating dist folder.

### Request ID Tracking

Every error response includes `requestId`. Use it to find related logs:

```bash
# Search logs for a specific request
grep "req:abc123" storage/logs/easystack-*.log
```

All logs related to that request will show up.

---

## Hot Reload

Changes to TypeScript files automatically reload the server:

1. Edit file in `src/`
2. Save
3. nodemon detects change and restarts
4. Server is back up in 1-2 seconds

Configuration in `nodemon.json`:
```json
{
  "watch": ["src"],
  "exec": "ts-node src/server.ts",
  "ext": "ts"
}
```

---

## Common Development Patterns

### Fetch from Database
```typescript
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  res.json({ success: true, data: user });
}));
```

### Create with Validation
```typescript
router.post('/users', asyncHandler(async (req, res) => {
  const { email, name } = req.body;
  
  if (!email || !name) {
    throw new BadRequestError('Email and name required');
  }
  
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ConflictError('Email already exists');
  }
  
  const user = await User.create({ email, name });
  res.status(201).json({ success: true, data: user });
}));
```

### Update with Error Handling
```typescript
router.put('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  logger.info('User updated', { userId: user.id });
  res.json({ success: true, data: user });
}));
```

### Delete with Cascade
```typescript
router.delete('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Optional: Delete related data
  await Post.deleteMany({ userId: req.params.id });
  
  logger.info('User deleted', { userId: req.params.id });
  res.json({ success: true, data: { id: req.params.id } });
}));
```

---

## Middleware Usage

### Current Middlewares

1. **requestContextMiddleware** - Adds request ID automatically
2. **errorHandlerMiddleware** - Catches all errors globally

### Adding Custom Middleware

Create in `src/middlewares/` and add to `src/server.ts`:

```typescript
app.use(customMiddleware);  // Before routes
app.use('/api', router);    // Routes
app.use(errorHandlerMiddleware);  // Last
```

---

## Next Steps

- [File Structure](FILE_STRUCTURE.md) - Deep dive into project structure
- [Error Handling](ERROR_HANDLING.md) - Comprehensive error patterns
- [Setup Guide](SETUP_GUIDE.md) - Database and environment setup

---

[← Back to README](../README.md)
