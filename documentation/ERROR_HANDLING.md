# Error Handling Documentation

This document provides comprehensive information about the error handling system in the EasyStack Backend application.

## Table of Contents

1. [Overview](#overview)
2. [Error Classes](#error-classes)
3. [HTTP Status Codes](#http-status-codes)
4. [Error Response Format](#error-response-format)
5. [Usage Examples](#usage-examples)
6. [Error Handling Middleware](#error-handling-middleware)
7. [Async Handler Wrapper](#async-handler-wrapper)
8. [Best Practices](#best-practices)

---

## Overview

The error handling system is built on a few key principles:

- **Consistency**: All errors follow a standard format
- **Clarity**: Each error has a specific error code and message
- **Context**: Errors include request ID and relevant details
- **Security**: Sensitive information is hidden in production environments
- **Operational vs Programming Errors**: Clear distinction between expected and unexpected errors

---

## Error Classes

All errors in the application should extend the base `AppError` class. This ensures consistency and enables proper handling.

### Base Class: `AppError`

```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    isOperational: boolean = true,
    details?: Record<string, any>
  )
}
```

**Parameters:**
- `message` (string): Human-readable error message
- `statusCode` (number): HTTP status code
- `errorCode` (string): Machine-readable error identifier (SCREAMING_SNAKE_CASE)
- `isOperational` (boolean): Whether this is an expected operational error
- `details` (object, optional): Additional context about the error

### Concrete Error Classes

#### 1. **BadRequestError** (400)

Used when the client sends an invalid request (validation errors, malformed data, etc.)

```typescript
import { BadRequestError } from '../errors';

throw new BadRequestError('Invalid email format', {
  field: 'email',
  receivedValue: 'invalid-email'
});
```

**When to use:**
- Validation errors
- Malformed request syntax
- Missing required fields
- Invalid parameter types

---

#### 2. **UnauthorizedError** (401)

Used when the request lacks valid authentication credentials or the credentials are invalid

```typescript
import { UnauthorizedError } from '../errors';

if (!token) {
  throw new UnauthorizedError('Missing authentication token');
}

if (!isValidToken(token)) {
  throw new UnauthorizedError('Invalid or expired token');
}
```

**When to use:**
- Missing authentication token
- Invalid/expired tokens
- Invalid username/password
- Token signature verification failed

---

#### 3. **ForbiddenError** (403)

Used when the client is authenticated but doesn't have permission to access the resource

```typescript
import { ForbiddenError } from '../errors';

if (user.role !== 'admin') {
  throw new ForbiddenError('Only administrators can delete users');
}
```

**When to use:**
- Insufficient permissions
- Role-based access control violations
- Attempting to access user-specific resources of another user
- Resource is restricted

---

#### 4. **NotFoundError** (404)

Used when the requested resource doesn't exist

```typescript
import { NotFoundError } from '../errors';

const user = await User.findById(userId);
if (!user) {
  throw new NotFoundError('User not found', { userId });
}
```

**When to use:**
- Requested resource doesn't exist
- Invalid ID provided
- Deleted resource is being accessed

---

#### 5. **ConflictError** (409)

Used when the request conflicts with the current state of the server

```typescript
import { ConflictError } from '../errors';

const existingEmail = await User.findByEmail(email);
if (existingEmail) {
  throw new ConflictError('Email already registered', {
    field: 'email',
    value: email
  });
}
```

**When to use:**
- Duplicate entry (unique constraint violation)
- Resource already exists
- State conflicts (e.g., deleting an already deleted resource)

---

#### 6. **ValidationError** (422)

Used when the request is well-formed but contains semantic errors

```typescript
import { ValidationError } from '../errors';

if (age < 18) {
  throw new ValidationError('Age must be at least 18', {
    field: 'age',
    value: age,
    reason: 'Age must be >= 18'
  });
}
```

**When to use:**
- Business logic validation failures
- Semantic validation errors
- Data validation that passes format but fails business rules

---

#### 7. **TooManyRequestsError** (429)

Used when rate limiting is triggered

```typescript
import { TooManyRequestsError } from '../errors';

if (loginAttempts > 5) {
  throw new TooManyRequestsError('Too many login attempts', {
    attemptCount: loginAttempts,
    retryAfter: 300 // seconds
  });
}
```

**When to use:**
- Rate limiting exceeded
- Too many requests in a time window
- Brute force protection

---

#### 8. **InternalServerError** (500)

Used for unexpected server errors

```typescript
import { InternalServerError } from '../errors';

try {
  // Some operation
} catch (err) {
  throw new InternalServerError('Failed to process payment', {
    originalError: err.message
  });
}
```

**When to use:**
- Unexpected exceptions
- Third-party service failures
- Unhandled edge cases

---

#### 9. **NotImplementedError** (501)

Used when a feature is not yet implemented

```typescript
import { NotImplementedError } from '../errors';

throw new NotImplementedError('Payment via crypto not yet supported');
```

**When to use:**
- Feature is planned but not implemented
- Upcoming features
- Disabled functionality

---

#### 10. **ServiceUnavailableError** (503)

Used when the server is temporarily unable to handle the request

```typescript
import { ServiceUnavailableError } from '../errors';

if (maintenanceMode) {
  throw new ServiceUnavailableError('Server is under maintenance', {
    estimatedDowntime: '2 hours'
  });
}
```

**When to use:**
- Server maintenance
- Database is down
- Overloaded server
- Dependent services are down

---

#### 11. **DatabaseConnectionError** (503)

Used when database connection fails

```typescript
import { DatabaseConnectionError } from '../errors';

try {
  await mongoose.connect(uri);
} catch (err) {
  throw new DatabaseConnectionError('MongoDB', err);
}
```

**When to use:**
- MongoDB connection fails
- MySQL connection fails
- Connection pool exhausted

---

#### 12. **DatabaseOperationError** (500)

Used when a database operation fails

```typescript
import { DatabaseOperationError } from '../errors';

try {
  await User.create(userData);
} catch (err) {
  throw new DatabaseOperationError('User creation', err);
}
```

**When to use:**
- Query execution fails
- Data integrity violations
- Transaction failures

---

## HTTP Status Codes

Complete reference of all HTTP status codes used in this application:

| Code | Class | Name | Purpose |
|------|-------|------|---------|
| 400 | BadRequestError | Bad Request | Invalid client request |
| 401 | UnauthorizedError | Unauthorized | Missing/invalid credentials |
| 403 | ForbiddenError | Forbidden | Authenticated but no permission |
| 404 | NotFoundError | Not Found | Resource doesn't exist |
| 409 | ConflictError | Conflict | Request conflicts with current state |
| 422 | ValidationError | Unprocessable Entity | Semantic validation failure |
| 429 | TooManyRequestsError | Too Many Requests | Rate limit exceeded |
| 500 | InternalServerError | Internal Server Error | Unexpected server error |
| 501 | NotImplementedError | Not Implemented | Feature not implemented |
| 503 | ServiceUnavailableError | Service Unavailable | Server temporarily unavailable |

---

## Error Response Format

All error responses follow this standard format:

```json
{
  "success": false,
  "error": {
    "message": "User not found",
    "code": "NOT_FOUND",
    "statusCode": 404,
    "requestId": "abc123def456",
    "details": {
      "userId": "123",
      "field": "id"
    }
  }
}
```

**Response Fields:**
- `success` (boolean): Always `false` for errors
- `error` (object): Error details
  - `message` (string): Human-readable error message
  - `code` (string): Machine-readable error code
  - `statusCode` (number): HTTP status code
  - `requestId` (string): Unique request identifier for tracing
  - `details` (object, optional): Additional context (omitted if empty)

---

## Usage Examples

### Example 1: Simple Route Handler with Error Handling

```typescript
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { NotFoundError, BadRequestError } from '../errors';

const router = Router();

router.get('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validation
  if (!id) {
    throw new BadRequestError('User ID is required');
  }

  // Business logic
  const user = await User.findById(id);

  // Not found error
  if (!user) {
    throw new NotFoundError('User not found', { userId: id });
  }

  // Success response
  res.json({
    success: true,
    data: user
  });
}));

export default router;
```

### Example 2: Complex Error Handling with Details

```typescript
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { 
  ValidationError, 
  ConflictError, 
  DatabaseOperationError 
} from '../errors';

const router = Router();

router.post('/users', asyncHandler(async (req, res) => {
  const { email, age } = req.body;

  // Validate age
  if (age < 18) {
    throw new ValidationError('Age must be at least 18', {
      field: 'age',
      receivedValue: age,
      minValue: 18
    });
  }

  // Check for duplicates
  const existing = await User.findByEmail(email);
  if (existing) {
    throw new ConflictError('Email already registered', {
      field: 'email',
      value: email
    });
  }

  // Create user
  try {
    const user = await User.create({ email, age });
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (err) {
    throw new DatabaseOperationError('User creation', err);
  }
}));

export default router;
```

### Example 3: Service Layer with Error Handling

```typescript
import { NotFoundError, DatabaseOperationError } from '../errors';

export class UserService {
  async getUserById(id: string) {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('User not found', { userId: id });
    }
    return user;
  }

  async updateUser(id: string, updates: any) {
    try {
      const user = await User.findByIdAndUpdate(id, updates, { new: true });
      if (!user) {
        throw new NotFoundError('User not found', { userId: id });
      }
      return user;
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      throw new DatabaseOperationError('User update', err);
    }
  }
}
```

---

## Error Handling Middleware

The error handling middleware is a global handler that catches all errors thrown in route handlers and formats them consistently.

### Middleware Setup

The middleware is applied in `src/server.ts`:

```typescript
import { errorHandlerMiddleware, notFoundMiddleware } from './middlewares/error-handler.middleware';

// ... other middleware ...

// Routes are defined here

// 404 handler (must be after all routes)
app.use(notFoundMiddleware);

// Error handler (must be last)
app.use(errorHandlerMiddleware);
```

### How It Works

1. **Catching Errors**: The middleware catches all errors passed to `next(error)`
2. **Logging**: Errors are logged with full context (request ID, environment, etc.)
3. **Response Formatting**: Errors are formatted into the standard response format
4. **Status Codes**: Appropriate HTTP status codes are set
5. **Security**: In production, sensitive details are hidden

### Logging Example

When an error is thrown, it's logged like this:

```
2026-01-26T10:30:45.123Z [easystack] [local] [error] [req:abc123def456] [NOT_FOUND] User not found
{
  "statusCode": 404,
  "errorCode": "NOT_FOUND",
  "isOperational": true,
  "details": {
    "userId": "123"
  },
  "stack": "Error: User not found\n at getUserById (..."
}
```

---

## Async Handler Wrapper

The `asyncHandler` is a utility that wraps async route handlers to automatically catch errors without needing try-catch blocks.

### Benefits

- No try-catch boilerplate in every route
- Errors automatically passed to error middleware
- Consistent error handling across all routes
- Cleaner, more readable code

### Usage

```typescript
// Without asyncHandler (verbose)
router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new NotFoundError('User not found'));
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// With asyncHandler (clean)
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  res.json(user);
}));
```

---

## Best Practices

### 1. **Use Specific Error Classes**

✅ **Do this:**
```typescript
if (!user) {
  throw new NotFoundError('User not found', { userId });
}
```

❌ **Don't do this:**
```typescript
if (!user) {
  throw new Error('User not found');
}
```

### 2. **Provide Context in Details**

✅ **Do this:**
```typescript
throw new ValidationError('Invalid age', {
  field: 'age',
  receivedValue: age,
  constraint: 'must be >= 18'
});
```

❌ **Don't do this:**
```typescript
throw new ValidationError('Invalid age');
```

### 3. **Don't Leak Sensitive Information**

✅ **Do this:**
```typescript
throw new InternalServerError('Failed to process payment');
// Details logged separately in logs
```

❌ **Don't do this:**
```typescript
throw new InternalServerError(
  `Failed to connect to payment API at ${apiUrl} with credentials ${apiKey}`
);
```

### 4. **Use AsyncHandler Wrapper**

✅ **Do this:**
```typescript
router.post('/users', asyncHandler(async (req, res) => {
  // ... code
}));
```

❌ **Don't do this:**
```typescript
router.post('/users', async (req, res) => {
  try {
    // ... code
  } catch (err) {
    next(err);
  }
});
```

### 5. **Distinguish Between 4xx and 5xx Errors**

- **4xx errors**: Client's fault (validation, auth, not found, etc.) - Use 400, 401, 403, 404, 409, 422, 429
- **5xx errors**: Server's fault (internal errors, service unavailable, etc.) - Use 500, 501, 503

### 6. **Log with Context**

The error middleware automatically logs errors with:
- Error code
- Status code
- Request ID
- Full stack trace (in non-production)
- Additional details

No need to manually log errors in route handlers.

### 7. **Handle Database Errors**

```typescript
try {
  await user.save();
} catch (err) {
  // Distinguish between different database errors
  if (err.code === 11000) {
    throw new ConflictError('Email already exists');
  }
  throw new DatabaseOperationError('User save', err);
}
```

### 8. **Validation in Service Layer**

Perform validation in the service layer and throw appropriate errors:

```typescript
// Service layer
async createUser(userData) {
  if (!userData.email) {
    throw new BadRequestError('Email is required');
  }
  if (!userData.age || userData.age < 18) {
    throw new ValidationError('Age must be at least 18');
  }
  // ... create user
}
```

---

## Error Code Reference

Complete list of all error codes used in the application:

| Error Code | HTTP Status | Error Class | Description |
|------------|-------------|-------------|-------------|
| BAD_REQUEST | 400 | BadRequestError | Invalid client request |
| UNAUTHORIZED | 401 | UnauthorizedError | Missing/invalid auth |
| FORBIDDEN | 403 | ForbiddenError | No permission |
| NOT_FOUND | 404 | NotFoundError | Resource not found |
| CONFLICT | 409 | ConflictError | Request conflicts with state |
| VALIDATION_ERROR | 422 | ValidationError | Semantic validation failed |
| TOO_MANY_REQUESTS | 429 | TooManyRequestsError | Rate limit exceeded |
| INTERNAL_SERVER_ERROR | 500 | InternalServerError | Unexpected server error |
| NOT_IMPLEMENTED | 501 | NotImplementedError | Feature not implemented |
| SERVICE_UNAVAILABLE | 503 | ServiceUnavailableError | Server unavailable |
| DATABASE_CONNECTION_ERROR | 503 | DatabaseConnectionError | DB connection failed |
| DATABASE_OPERATION_ERROR | 500 | DatabaseOperationError | DB operation failed |

---

## Summary

This error handling system provides:

✅ Consistency across all errors  
✅ Clear error codes and messages  
✅ Detailed context for debugging  
✅ Automatic error catching with asyncHandler  
✅ Proper HTTP status codes  
✅ Security in production  
✅ Easy-to-follow logging  

By following these patterns and best practices, your API will have robust, professional error handling.

---

## Related Documentation

- [Local Development](LOCAL_DEVELOPMENT.md) - Learn how to use errors when coding
- [File Structure](FILE_STRUCTURE.md) - Where error classes are defined
- [Setup Guide](SETUP_GUIDE.md) - Project setup and configuration

---

[← Back to README](../README.md)
