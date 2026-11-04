# Architectural Patterns & Coding Standards

## 1. Strict 4-Layer Architecture

EasyStack enforces a strict **Route -> Controller -> Service -> Repository** pattern. This layer separation is non-negotiable for all new features and modifications.

```text
HTTP Request
     │
     ▼
┌──────────────┐
│  Route Layer │ ── Express routes, path definitions, and middleware guards:
└──────────────┘    authenticate, authorize, billingMiddleware
     │
     ▼
┌──────────────┐
│  Controller  │ ── HTTP Adapter: extracts parameters, parses query/body,
└──────────────┘    calls Service, formats output with ok(res, data)
     │
     ▼
┌──────────────┐
│ Service Layer│ ── Business Logic: domain rules, validations, multi-store
└──────────────┘    transactions, cache invalidations, and BullMQ enqueuing
     │
     ▼
┌──────────────┐
│  Repository  │ ── Data Access: Prisma queries, Mongoose operations,
└──────────────┘    and soft-delete filtering (removedAt: null)
```

### Layer Hard Lines

| Layer | DO | DO NOT |
|---|---|---|
| **Route** | Attach security middlewares (`authenticate`, `authorize`, `billingMiddleware`). Declare URL params and HTTP verbs. | Include any request handling or business logic inline. |
| **Controller** | Extract and sanitize `req.params`, `req.query`, `req.body`. Invoke service methods. Return `ok(res, data)` or call `next(error)`. | Execute database queries (never import Prisma or Mongoose models directly). Handle business logic. |
| **Service** | Implement business rules, calculations, cross-store coordination, Redis cache invalidation (`AuthorizationCacheService.evict()`), and job enqueuing. | Reference Express `req`, `res`, or `next` objects. Return HTTP status codes directly. |
| **Repository** | Execute database operations against MySQL (Prisma) or MongoDB (Mongoose). Filter `where: { removedAt: null }`. | Coordinate multi-module business workflows or validate authorization. |

---

## 2. Hard Invariants & Rules

### Invariant 1: Soft Deletions
- We **never** execute raw `DELETE` SQL statements against Users, Workspaces, Projects, or Members.
- Perform soft deletion by setting `removedAt: new Date()`.
- **All retrieval queries must explicitly filter `removedAt: null`**:
  ```typescript
  // CORRECT
  const member = await prisma.workspaceMember.findFirst({
    where: { id: memberId, removedAt: null }
  });

  // INCORRECT - Will retrieve ghost records!
  const member = await prisma.workspaceMember.findUnique({
    where: { id: memberId }
  });
  ```

### Invariant 2: Unified Success Response (`ok`)
- HTTP 200/201 responses must use the `ok(res, data)` utility from [`src/utils/response.ts`](file:///home/eteknas/Projects/easystack-backend/src/utils/response.ts) to maintain uniform JSON shapes across the API.

### Invariant 3: Typed Error Exceptions
- Never return manual JSON error bodies like `res.status(400).json({ error: ... })`.
- Always throw a specialized subclass of [`AppError`](file:///home/eteknas/Projects/easystack-backend/src/errors/AppError.ts) (`BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`). The central error middleware will intercept and format it.

---

## 3. How to Implement a New Feature (Step-by-Step)

When implementing a new feature or endpoint, follow this exact workflow:

### Step 1: Data Access (Repository)
Create or update a repository under `src/repositories/` (for relational MySQL) or `src/models/` (for MongoDB). Ensure all Prisma `findMany` and `findFirst` calls filter `removedAt: null`.

### Step 2: Domain Business Logic (Service)
Create or update a domain service under `src/services/`.
- Validate domain invariants and business rules.
- If mutations affect a user's permissions or roles, call `await AuthorizationCacheService.evict(userId)`.
- If background processing is needed, dispatch a job to the appropriate BullMQ queue.

### Step 3: HTTP Adapter (Controller)
Create a dedicated controller under `src/routes/<domain>/`:
```typescript
import { Request, Response } from 'express';
import { ProjectService } from '../../services/project.service';
import { ok } from '../../utils/response';

export const getProjectDetails = async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);
  const data = await ProjectService.getProjectById(projectId);
  return ok(res, data);
};
```

### Step 4: Route Declaration & Middleware Attachment
Mount the route in `src/routes/<domain>/<domain>.routes.ts`:
```typescript
router.get(
  '/:projectId/details',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.READ,
    scopeId: req => req.params.projectId as string,
  }),
  getProjectDetails
);
```

### Step 5: Verification & Tests
Add an automated test under `tests/` verifying both permitted access and unauthorized access.
