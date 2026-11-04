# Error Handling & Response Standards

## 1. Principles & Standard Response Format

EasyStack uses a centralized error-handling system. Controllers do not craft manual HTTP error responses; they throw typed exceptions that extend [`AppError`](file:///home/eteknas/Projects/easystack-backend/src/errors/AppError.ts).

The global error handling middleware ([`src/middlewares/error-handler.middleware.ts`](file:///home/eteknas/Projects/easystack-backend/src/middlewares/error-handler.middleware.ts)) catches all thrown errors and formats them into a standard JSON envelope:

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format.",
    "details": {
      "field": "email"
    }
  },
  "requestId": "d8a1f872-358b-4a57-b08e-89a71a938c23"
}
```

---

## 2. The `AppError` Class Hierarchy

All application errors inherit from `AppError` in [`src/errors/AppError.ts`](file:///home/eteknas/Projects/easystack-backend/src/errors/AppError.ts):

| Class | HTTP Status | Default Error Code | Usage |
|---|---|---|---|
| `BadRequestError` | 400 | `BAD_REQUEST` | Malformed input, uneditable environment, invalid keys |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | Missing, expired, or invalid JWT or cookie |
| `ForbiddenError` | 403 | `FORBIDDEN` | Caller lacks RBAC permission or quota is exhausted |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource (project, feed, workspace, user) does not exist |
| `ConflictError` | 409 | `CONFLICT` | Resource already exists (e.g. subdomain taken, duplicate email) |
| `ValidationError` | 422 | `VALIDATION_ERROR` | Schema validation failure, Zod parsing error |
| `TooManyRequestsError` | 429 | `TOO_MANY_REQUESTS` | Exceeded rate limit on auth or public endpoints |
| `InternalServerError` | 500 | `INTERNAL_ERROR` | Unexpected unhandled exceptions |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` | Database or Redis connection failure |

---

## 3. How to Throw Errors in Services

```typescript
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors';

// 1. Throwing standard not found
if (!project) {
  throw new NotFoundError('Project not found');
}

// 2. Throwing bad request with context
if (!targetEnv.isEditable) {
  throw new BadRequestError('Cannot edit feeds in a read-only environment.');
}

// 3. Throwing with custom error code and details
if (isQuotaExceeded) {
  throw new ForbiddenError(
    'Workspace has reached maximum allowed projects for active plan',
    'QUOTA_EXCEEDED',
    { quota: 'projects', limit: 3, current: 3 }
  );
}
```

---

## 4. Successful Response Standards (`ok`)

To guarantee unified JSON structures across all 200/201 responses, controllers use the `ok` response utility:

```typescript
import { ok } from '../../utils/response';

export const getProject = async (req: Request, res: Response) => {
  const project = await ProjectService.getProjectById(req.params.projectId);
  return ok(res, project);
};
```

Standard Output Shape:
```json
{
  "status": "success",
  "data": { ... }
}
```
