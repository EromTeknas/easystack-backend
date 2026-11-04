# Authorization & RBAC Module

## 1. Purpose & Responsibilities

The **Authorization & RBAC Module** provides the fine-grained access control engine protecting all workspace and project resources. It manages roles, permissions, cache compilation in Redis, implicit inheritance across parent and child scopes, and route-level authorization guards.

### Core Responsibilities
- Define role-to-permission mappings in TypeScript configuration files.
- Resolve user permissions dynamically across two scopes: `workspace` and `project`.
- Synthesize implicit administrative inheritance (`WORKSPACE_ADMIN -> PROJECT_ADMIN`).
- Compile flattened, high-speed authorization nodes in Redis (`authorization:v1:<userId>`).
- Enforce the `authorize` Express middleware on protected API endpoints.
- Manage cache invalidation (`AuthorizationCacheService.evict(userId)`) on any role change.

---

## 2. File Responsibility Map

```text
src/services/authorization/
├── configs/
│   ├── permission.config.ts            # Complete list of granular permissions
│   ├── workspace-roles.config.ts       # WORKSPACE_OWNER, ADMIN, MEMBER, VIEWER, GUEST definitions
│   ├── project-roles.config.ts         # PROJECT_OWNER, ADMIN, EDITOR, CONTRIBUTOR, VIEWER definitions
│   └── roles-registry.config.ts        # Role-to-scope registry and validation maps
│
├── constants/
│   ├── permission.constants.ts         # PERMISSIONS constant enum used in routes
│   └── permission-groups.constants.ts  # Macro permission bundles (e.g., PROJECT_ALL, WORKSPACE_ALL)
│
├── middlewares/
│   └── authorize.middleware.ts         # authorize({ scope, permission, scopeId }) Express guard
│
├── services/
│   ├── authorization.service.ts        # Primary RBAC facade: can(), hasRole(), getScopeIdsWithPermission()
│   ├── buid-cache.service.ts           # AuthorizationBuilder: pulls assignments and compiles Redis cache
│   └── resolve-permissions.ts          # PermissionResolver: merges base, custom, and denied permissions
│
├── repositories/
│   ├── authorization.repository.ts     # getAssignments(): Queries DB and computes implicit project roles
│   ├── workspace-member.repository.ts  # WorkspaceMember queries with removedAt: null filtering
│   ├── project-member.repository.ts    # ProjectMember queries with removedAt: null filtering
│   └── role-permission.repository.ts   # Resolves Role to Permission relations in Prisma
│
├── cache/
│   └── cache.service.ts                # Redis cache operations: get(), set(), evict(userId)
│
└── types/
    ├── authorization.type.ts           # AuthorizationCache, AuthorizationNode interfaces
    ├── role-definition.type.ts         # RoleDefinition interface
    └── permission.type.ts              # PermissionKey types
```

---

## 3. Public Interfaces & Key Methods

### `AuthorizationService` ([`src/services/authorization/services/authorization.service.ts`](file:///home/eteknas/Projects/easystack-backend/src/services/authorization/services/authorization.service.ts))
- `can(userId, permission, scope, scopeId)`: Primary boolean check used by the `authorize` middleware. Reads from Redis cache, compiling on-demand if missing.
- `hasRole(userId, roleKey, scope, scopeId)`: Verifies if a user holds a specific role in a scope.
- `getScopeIdsWithPermission(userId, scope, permission)`: Returns an array of scope IDs (e.g., project IDs) where the user holds the required permission. Essential for filtering listing queries so users only see authorized resources.

### `AuthorizationCacheService` ([`src/services/authorization/cache/cache.service.ts`](file:///home/eteknas/Projects/easystack-backend/src/services/authorization/cache/cache.service.ts))
- `get(userId)`: Fetches cached `AuthorizationCache` from Redis key `authorization:v1:<userId>`.
- `set(userId, cache)`: Stores compiled cache in Redis with TTL.
- `evict(userId)`: Evicts user cache from Redis. **Must be called by any service modifying a user's role or membership**.

### `authorize` Middleware ([`src/services/authorization/middlewares/authorize.middleware.ts`](file:///home/eteknas/Projects/easystack-backend/src/services/authorization/middlewares/authorize.middleware.ts))
Factory generating route-level middleware:
```typescript
authorize({
  scope: 'workspace' | 'project',
  permission: string,
  scopeId: (req: Request) => string
})
```
Halts request with `403 Forbidden` (`FORBIDDEN` error) if permission check fails.

---

## 4. Implicit Inheritance Mechanics

In [`AuthorizationRepository.getAssignments()`](file:///home/eteknas/Projects/easystack-backend/src/services/authorization/repositories/authorization.repository.ts):
```typescript
// If Workspace Admin or Owner, inject all projects in the workspace
if (workspaceMember.role.key === 'WORKSPACE_OWNER' || workspaceMember.role.key === 'WORKSPACE_ADMIN') {
  const allWorkspaceProjects = await prisma.project.findMany({
    where: { workspaceId: workspaceMember.workspaceId, removedAt: null },
    select: { id: true }
  });
  // Map WORKSPACE_OWNER -> PROJECT_OWNER, WORKSPACE_ADMIN -> PROJECT_ADMIN
  // Inject project nodes into user's compiled assignment list
}
```

---

## 5. Relevant Tests

- [`tests/rbac/permission-matrix.test.ts`](file:///home/eteknas/Projects/easystack-backend/tests/rbac/permission-matrix.test.ts): Validates that each role possesses its expected permission sets.
- [`tests/rbac/project-authorization.test.ts`](file:///home/eteknas/Projects/easystack-backend/tests/rbac/project-authorization.test.ts): Tests project-level authorization and implicit admin access.
- [`tests/rbac/nested-resource-idor.test.ts`](file:///home/eteknas/Projects/easystack-backend/tests/rbac/nested-resource-idor.test.ts): Verifies cross-tenant / IDOR protection across workspaces.
- [`tests/rbac/role-assignment.test.ts`](file:///home/eteknas/Projects/easystack-backend/tests/rbac/role-assignment.test.ts): Verifies cache eviction and member role updates.
