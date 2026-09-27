# Backend Roles & Permissions

This document extracts the complex internals of the Authorization Engine.

## 1. Core Definitions
- **Permissions**: Defined in `src/services/authorization/configs/permission.config.ts`.
- **Roles**: Defined in `workspace-roles.config.ts` and `project-roles.config.ts`.
- **Resolution**: `PermissionGroups` combine granular permissions (e.g., `project:read`, `localization:update`) into massive arrays for roles.

## 2. Global RBAC Functions (`AuthorizationService`)
The primary entrypoint for permission checks is `AuthorizationService` (`src/services/authorization/services/authorization.service.ts`).
Key methods:
- `AuthorizationService.can(userId, permission, scope, scopeId)`: Used heavily by the `authorize` middleware to validate incoming HTTP requests.
- `AuthorizationService.getScopeIdsWithPermission(...)`: Allows filtering database queries so a user only sees projects they have access to.
- `AuthorizationService.hasRole(...)`: Used to check specific roles.

## 3. The `authorize` Middleware
This is the **hard line** guard for API security.
```typescript
import { authorize } from "../../services/authorization/middlewares/authorize.middleware";

router.get('/:projectId', authorize({ 
    scope: 'project', 
    permission: 'project:read', 
    scopeId: req => req.params.projectId 
}), projectController.getProject);
```
**NEVER** bypass this middleware for protected routes. 

## 4. Cache Engine & Implicit Inheritance
- Permissions are cached in Redis (`authorization:v1:userId`) via `AuthorizationCacheService`.
- **Dynamic Merging**: The `AuthorizationBuilder` (`buid-cache.service.ts`) fetches all explicit assignments from `ProjectMember` and `WorkspaceMember`.
- **Implicit Inheritance**: If a user is a `WORKSPACE_ADMIN` or `WORKSPACE_OWNER`, the cache builder instantly synthesizes `PROJECT_ADMIN` rights for *every* project in the workspace, silently overlaying and overriding any explicit legacy assignments. 
- **Security Invariant**: When modifying a user's role to a Workspace Admin, we explicitly soft-delete their existing `ProjectMember` records to prevent "hidden state" attack vectors.

## 5. Other Important Backend Provisions
- **Global Error Handler**: Wraps controllers with `asyncHandler` to safely forward all promise rejections to the central error middleware without crashing Node.
- **Soft Deletions**: We strictly use `removedAt: Date`. All `findMany` queries must contain `removedAt: null` to avoid retrieving ghost members.
