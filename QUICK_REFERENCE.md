# Authorization System — Quick Reference

## TL;DR: How It Works

### Two-Layer Model
1. **Workspace Role** (OWNER/ADMIN/USER) → who has organizational authority
2. **Project Role** (EDITOR/PUBLISHER/RELEASE_MANAGER/VIEWER) → what they can do

### Key Rule
**OWNER/ADMIN are auto-added to all projects with default roles.** No implicit access—everything explicit in DB.

## Common Tasks

### Check If User Can Do Something
```typescript
await authorizationService.requireProjectPermission(
  userId,
  projectId,
  ProjectPermissionAction.MODEL_CREATE
); // Throws if denied
```

### Get What User Can Do
```typescript
const capabilities = await authorizationService.getProjectEffectivePermissions(
  userId,
  projectId
); // Returns Set of allowed actions
```

### Add User to Project
```typescript
await authorizationService.addUserToProject(
  currentUserId,      // who's adding
  projectId,
  newUserId,
  [ProjectRoleEnum.VIEWER]
);
```

### Assign More Roles
```typescript
await authorizationService.assignProjectRoles(
  currentUserId,
  projectId,
  userId,
  [ProjectRoleEnum.EDITOR, ProjectRoleEnum.PUBLISHER]
);
```

## In Routes

### Use Middleware
```typescript
router.post(
  '/projects/:projectId/models',
  requireProjectPermission(ProjectPermissionAction.MODEL_CREATE),
  createModelHandler
);
```

### In Handler
```typescript
export const createModel = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const projectId = Number(req.params.projectId);

  // Option 1: Check with middleware above (no check needed here)
  // Option 2: Check explicitly
  await authorizationService.requireProjectPermission(
    userId,
    projectId,
    ProjectPermissionAction.MODEL_CREATE
  );

  // Proceed
  const model = await ModelService.create(projectId, req.body);
  return ok(res, { model });
});
```

## Permission Reference

| Action | Use Case |
|--------|----------|
| `MODEL_CREATE/UPDATE/DELETE` | Schema/model management |
| `CONTENT_CREATE/UPDATE/DELETE` | Content management |
| `PUBLISH/PUBLISH_UNPUBLISH` | Publishing |
| `RELEASE_CREATE/RELEASE_DEPLOY` | Deployments |
| `SETTINGS_READ/UPDATE` | Configuration |
| `MEMBERS_VIEW` | Team visibility |

## Default Role Permissions

| Role | Capabilities | Example Use |
|------|--------------|-------------|
| **EDITOR** | Full create/read/update/delete on models & content | Content writer |
| **PUBLISHER** | Publish/unpublish content | Content approver |
| **RELEASE_MANAGER** | Create & deploy releases | DevOps engineer |
| **VIEWER** | Read-only everything | Stakeholder |

## Setup (One Time)

```bash
# 1. Apply schema
npm run prisma:migrate

# 2. Seed permissions
npx ts-node prisma/seed-project-permissions.ts

# 3. If existing data, assign roles
npx ts-node src/cli/migrate-project-roles.ts
```

## What Happens When...

| Event | Result |
|-------|--------|
| Create project | OWNER/ADMIN auto-added with default roles |
| Add USER to workspace | Must manually add to projects |
| Promote USER to ADMIN | Auto-added to all existing projects |
| Create project with no OWNER/ADMIN | Project created, but only the creator can access |

## Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| "Permission denied: project.model.create" | User lacks EDITOR role | Add EDITOR role |
| "not_project_member" | User not in ProjectMember table | Use `addUserToProject()` |
| "no_project_roles" | User has no roles in project | Assign at least one role |
| "not_workspace_member" | User not in workspace | Add to workspace first |

## Debug Checklist

- [ ] Is user in `WorkspaceMember`? (prerequisite)
- [ ] Is user in `ProjectMember` with `isActive=true`?
- [ ] Are `ProjectMemberRole` records present?
- [ ] Is `ProjectRolePermission` seeded for the role/action pair?
- [ ] Check authorization service logs for resolution reason

## Database Queries

### Find User's Project Roles
```sql
SELECT pmr.role 
FROM ProjectMemberRole pmr
JOIN ProjectMember pm ON pmr.projectMemberId = pm.id
WHERE pm.userId = ? AND pm.projectId = ? AND pm.isActive = true;
```

### Find User's Project Permissions
```sql
SELECT DISTINCT prp.action
FROM ProjectMemberRole pmr
JOIN ProjectMember pm ON pmr.projectMemberId = pm.id
JOIN ProjectRolePermission prp ON pmr.role = prp.role
WHERE pm.userId = ? AND pm.projectId = ? AND pm.isActive = true;
```

### Auto-Added Members to Project
```sql
SELECT pm.userId, wm.role
FROM ProjectMember pm
JOIN WorkspaceMember wm ON pm.userId = wm.userId 
WHERE pm.projectId = ? AND wm.role IN ('OWNER', 'ADMIN');
```

## Testing Template

```typescript
test('User with EDITOR role can create models', async () => {
  // Setup: Add user with EDITOR role
  await authorizationService.addUserToProject(
    creatorId, projectId, userId, [ProjectRoleEnum.EDITOR]
  );

  // Test: Check permission
  const result = await authorizationService.getProjectPermission(
    userId, projectId, ProjectPermissionAction.MODEL_CREATE
  );

  // Verify
  expect(result.allowed).toBe(true);
  expect(result.reason).toBe('project_role_permission');
});

test('User with VIEWER role cannot create models', async () => {
  // Setup: Add user with VIEWER role
  await authorizationService.addUserToProject(
    creatorId, projectId, userId, [ProjectRoleEnum.VIEWER]
  );

  // Test: Check permission
  expect(() =>
    authorizationService.requireProjectPermission(
      userId, projectId, ProjectPermissionAction.MODEL_CREATE
    )
  ).rejects.toThrow(ForbiddenError);
});
```

## Constants Reference

### Project Permission Actions
```typescript
ProjectPermissionAction.MODEL_CREATE
ProjectPermissionAction.MODEL_READ
ProjectPermissionAction.MODEL_UPDATE
ProjectPermissionAction.MODEL_DELETE

ProjectPermissionAction.CONTENT_CREATE
ProjectPermissionAction.CONTENT_READ
ProjectPermissionAction.CONTENT_UPDATE
ProjectPermissionAction.CONTENT_DELETE

ProjectPermissionAction.PUBLISH
ProjectPermissionAction.PUBLISH_UNPUBLISH
ProjectPermissionAction.PUBLISH_READ

ProjectPermissionAction.RELEASE_CREATE
ProjectPermissionAction.RELEASE_DEPLOY
ProjectPermissionAction.RELEASE_READ

ProjectPermissionAction.SETTINGS_READ
ProjectPermissionAction.SETTINGS_UPDATE
ProjectPermissionAction.MEMBERS_VIEW
```

### Project Roles
```typescript
ProjectRoleEnum.EDITOR           // Full access to models & content
ProjectRoleEnum.PUBLISHER        // Can publish content
ProjectRoleEnum.RELEASE_MANAGER  // Can deploy releases
ProjectRoleEnum.VIEWER           // Read-only
```

## Key Imports

```typescript
// Service
import { authorizationService } from '../services/authorization.service';

// Types
import {
  ProjectRoleEnum,
  ProjectPermissionAction,
  ROLE_PERMISSION_MAP,
  getPermissionsForRoles,
  canRolePerform,
} from '../constants/projectRoles';

// Middleware
import {
  requireProjectPermission,
  attachProjectPermissions,
} from '../middlewares/project-authorization.middleware';

// Errors
import { ForbiddenError } from '../errors';
```

## Full Documentation

See [`documentation/AUTHORIZATION_SYSTEM.md`](./documentation/AUTHORIZATION_SYSTEM.md) for complete reference.

---

**Last Updated:** March 22, 2026
