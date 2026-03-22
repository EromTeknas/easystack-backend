# Clean Scalable Authorization System

## Overview

This document describes the comprehensive two-layer authorization system implemented in EasyStack backend, combining **workspace roles** (global authority) and **project roles** (local behavior).

## Architecture

### Layer 1: Workspace Roles (Global)

Workspace roles define organizational authority and are stored in `WorkspaceMember.role`:

| Role | Authority | Project Access | Description |
|------|-----------|-----------------|-------------|
| **OWNER** | Full access | All projects (auto-added) | Can manage workspace and all projects |
| **ADMIN** | High-level access | All projects (auto-added) | Can manage projects and workspace members |
| **USER** | Limited access | Explicit assignment only | Can only access explicitly assigned projects |

### Layer 2: Project Roles (Local)

Project roles define what actions a user can perform **within a project**. A user can have **multiple project roles**, and permissions are the **union** of all assigned roles.

Stored in `ProjectMemberRole.role` with these values:

| Role | Use Case | Key Permissions |
|------|----------|-----------------|
| **EDITOR** | Content creators | Create/read/update/delete models & content |
| **PUBLISHER** | Content approvers | Publish/unpublish content |
| **RELEASE_MANAGER** | DevOps/deployment | Create & deploy releases |
| **VIEWER** | Read-only access | Read models, content, releases |

## Key Design Rules

### Rule 1: Workspace Membership is Mandatory
Users must belong to a workspace to access any project within it.

**Implementation:**
```sql
SELECT * FROM WorkspaceMember WHERE userId = ? AND workspaceId = ?
```

### Rule 2: Auto-Add to Projects
When a new project is created, all **OWNER** and **ADMIN** workspace members are automatically added as project members.

**Trigger:** `ProjectService.createProject()` → `authorizationService.autoAddWorkspaceAdminsToProject()`

**Benefit:**
- No implicit access—everything is explicit in DB
- Consistent data model
- Easy auditing

### Rule 3: All Users Must Have Project Roles
Including OWNER and ADMIN. No implicit permissions.

**Enforcement:**
```typescript
// In authorizationService.getProjectPermission()
if (projectMemberRoles.length === 0) {
  return { allowed: false, reason: 'no_project_roles' }
}
```

### Rule 4: Permission Resolution (Permission Union)

```
User Permission Set = Union of all Project Roles' Permissions
```

**Algorithm:**
1. Verify workspace membership ✓
2. Verify project membership ✓
3. Fetch all `ProjectMemberRole` records for user
4. Get permissions for each role from `ROLE_PERMISSION_MAP`
5. Return union (user can perform action if any role allows it)

### Rule 5: No Bypass Logic
Workspace roles do **not** bypass project permissions. OWNER/ADMIN must still have explicit project roles and act through those roles.

## Data Models

### WorkspaceMember
```prisma
model WorkspaceMember {
  id            Int
  workspaceId   Int
  userId        Int
  role          WorkspaceMember_role  // OWNER | ADMIN | USER
  createdAt     DateTime
  // ... other fields
}

enum WorkspaceMember_role {
  OWNER
  ADMIN
  USER
}
```

### ProjectMember
```prisma
model ProjectMember {
  id               Int
  projectId        Int
  workspaceId      Int
  userId           Int
  isActive         Boolean
  assignedAt       DateTime
  assignedByUserId Int?
  // ... other fields
  projectMemberRoles ProjectMemberRole[]
}
```

### ProjectMemberRole (NEW)
```prisma
model ProjectMemberRole {
  id              Int
  projectMemberId Int
  role            ProjectRole        // EDITOR | PUBLISHER | RELEASE_MANAGER | VIEWER
  assignedAt      DateTime
  assignedByUserId Int?
  
  projectMember   ProjectMember @relation(...)
}

enum ProjectRole {
  EDITOR
  PUBLISHER
  RELEASE_MANAGER
  VIEWER
}
```

### ProjectRolePermission (NEW)
```prisma
model ProjectRolePermission {
  id     Int
  role   ProjectRole
  action String  // e.g., "project.model.create"
  
  @@unique([role, action])
}
```

## Service Layer

### AuthorizationService Methods

#### `getProjectPermission(userId, projectId, action): PermissionResolution`
Check if user can perform an action in a project.

```typescript
const result = await authorizationService.getProjectPermission(
  userId,
  projectId,
  ProjectPermissionAction.MODEL_CREATE
);

if (result.allowed) {
  // Proceed with action
}
```

#### `requireProjectPermission(userId, projectId, action): void`
Check permission and throw `ForbiddenError` if denied.

```typescript
await authorizationService.requireProjectPermission(
  userId,
  projectId,
  ProjectPermissionAction.MODEL_CREATE
); // Throws if denied
```

#### `getProjectRoles(userId, projectId): ProjectRoleEnum[]`
Get all project roles assigned to a user.

```typescript
const roles = await authorizationService.getProjectRoles(userId, projectId);
// ['EDITOR', 'PUBLISHER']
```

#### `getProjectEffectivePermissions(userId, projectId): Set<ProjectPermissionAction>`
Get all effective permissions for a user in a project.

```typescript
const permissions = await authorizationService.getProjectEffectivePermissions(
  userId,
  projectId
);
// Set { 'project.model.create', 'project.content.update', ... }
```

#### `assignProjectRoles(assignedBy, projectId, userId, roles): void`
Assign one or more project roles to a user.

```typescript
await authorizationService.assignProjectRoles(
  assignedByUserId,
  projectId,
  targetUserId,
  [ProjectRoleEnum.EDITOR, ProjectRoleEnum.PUBLISHER]
);
```

#### `addUserToProject(addedBy, projectId, userId, initialRoles): void`
Add a user to a project (create ProjectMember) and assign initial roles.

```typescript
await authorizationService.addUserToProject(
  addedByUserId,
  projectId,
  newUserId,
  [ProjectRoleEnum.VIEWER]
);
```

#### `autoAddWorkspaceAdminsToProject(projectId, workspaceId): void`
Auto-add OWNER and ADMIN workspace members to a project (called on project creation).

**Default roles assigned:**
- OWNER/ADMIN get: `[EDITOR, PUBLISHER, RELEASE_MANAGER]`

## Middleware

### `requireProjectPermission(action: ProjectPermissionAction)`
Express middleware factory to check project permission on route.

```typescript
import { requireProjectPermission } from '../middlewares/project-authorization.middleware';
import { ProjectPermissionAction } from '../constants/projectRoles';

router.post(
  '/projects/:projectId/models',
  requireProjectPermission(ProjectPermissionAction.MODEL_CREATE),
  createModelController
);
```

### `attachProjectPermissions(req, res, next)`
Attach user's effective permissions to `req.projectPermissions` for UI rendering.

```typescript
router.get(
  '/projects/:projectId',
  attachProjectPermissions,
  getProjectController
);

// In controller:
const uiCapabilities = req.projectPermissions;
// ['project.model.read', 'project.content.update', ...]
```

## Role Permission Mapping

**EDITOR** can:
- Create/read/update/delete models
- Create/read/update/delete content
- Read publishing status
- View project settings & members

**PUBLISHER** can:
- Read models & content
- Publish/unpublish content
- View releases
- View project settings & members

**RELEASE_MANAGER** can:
- Read models & content
- Create & deploy releases
- View project settings & members

**VIEWER** can:
- Read-only: models, content, releases, settings

## Migration & Setup

### 1. Apply Prisma Migration
```bash
npm run prisma:migrate
```

Creates:
- `ProjectMemberRole` table
- `ProjectRolePermission` table
- New `ProjectRole` enum

### 2. Seed Project Role Permissions
```bash
npx ts-node prisma/seed-project-permissions.ts
```

Populates `ProjectRolePermission` table with all role→permission mappings.

### 3. Migrate Existing Project Members
```bash
npx ts-node src/cli/migrate-project-roles.ts
```

Assigns project roles to existing project members based on their workspace roles:
- OWNER → `[EDITOR, PUBLISHER, RELEASE_MANAGER]`
- ADMIN → `[EDITOR, PUBLISHER]`
- USER → `[VIEWER]`

## Usage Patterns

### Pattern 1: Check Permission in Controller
```typescript
export const createModel = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const projectId = Number(req.params.projectId);

  // Check permission (throws if denied)
  await authorizationService.requireProjectPermission(
    userId,
    projectId,
    ProjectPermissionAction.MODEL_CREATE
  );

  // Proceed with creation
  const model = await ModelService.create(projectId, req.body);
  return ok(res, { model });
});
```

### Pattern 2: Use Middleware
```typescript
router.post(
  '/projects/:projectId/models',
  requireProjectPermission(ProjectPermissionAction.MODEL_CREATE),
  createModel
);
```

### Pattern 3: Get User's Capabilities
```typescript
const permissions = await authorizationService.getProjectEffectivePermissions(
  userId,
  projectId
);

// Send to frontend for UI rendering
return ok(res, {
  project,
  capabilities: Array.from(permissions),
});
```

### Pattern 4: Assign Roles
```typescript
// Add user to project with VIEWER role
await authorizationService.addUserToProject(
  currentUserId,
  projectId,
  newUserId,
  [ProjectRoleEnum.VIEWER]
);

// Later, promote to EDITOR
await authorizationService.assignProjectRoles(
  currentUserId,
  projectId,
  newUserId,
  [ProjectRoleEnum.EDITOR] // Union with VIEWER
);
```

## Consistency Guarantees

1. **No Implicit Access**: All project access is explicit in `ProjectMember` + `ProjectMemberRole`
2. **No Bypass Logic**: OWNER/ADMIN must have explicit project roles
3. **Audit Trail**: All role assignments include `assignedByUserId` + timestamp
4. **Data Integrity**: Foreign keys + unique constraints prevent inconsistencies

## FAQ

**Q: Can a user have multiple project roles?**
A: Yes. Permissions are the union of all assigned roles.

**Q: Does workspace role OWNER have implicit project access?**
A: No. OWNER is auto-added to all projects with explicit roles, but must have project roles to perform actions.

**Q: What happens when a USER becomes ADMIN?**
A: 
1. Workspace role changes to ADMIN
2. User is auto-added to all existing projects (if not already)
3. Default roles assigned: `[EDITOR, PUBLISHER]`

**Q: Can I override project roles with workspace role?**
A: No. Project behavior is always driven by project roles. Workspace role only affects access eligibility.

**Q: What if a project member has no project roles?**
A: They cannot perform any actions. This state is prevented by `addUserToProject()` requiring at least one role.

## Testing

### Test Permission Check
```typescript
test('EDITOR can create models', async () => {
  const permission = await authorizationService.getProjectPermission(
    editorUserId,
    projectId,
    ProjectPermissionAction.MODEL_CREATE
  );
  expect(permission.allowed).toBe(true);
});

test('VIEWER cannot create models', async () => {
  const permission = await authorizationService.getProjectPermission(
    viewerUserId,
    projectId,
    ProjectPermissionAction.MODEL_CREATE
  );
  expect(permission.allowed).toBe(false);
});
```

### Test Auto-Add on Project Creation
```typescript
test('OWNER auto-added to new project', async () => {
  const newProjectId = await ProjectService.createProject(workspaceId, {...});
  
  const membership = await prisma.projectMember.findUnique({
    where: { uk_project_user: { projectId: newProjectId, userId: ownerUserId } }
  });
  
  expect(membership).toBeDefined();
  expect(membership?.projectMemberRoles.length).toBeGreaterThan(0);
});
```

## Troubleshooting

**Issue: User can't access project after promotion**
- Verify workspace role changed
- Check if auto-add was triggered (look at ProjectMember records)
- Ensure ProjectMemberRole records exist

**Issue: Permission check returns 'not_project_member'**
- User must be in ProjectMember table with isActive=true
- If workspace role is OWNER/ADMIN, run autoAddWorkspaceAdminsToProject

**Issue: User has multiple roles but still can't perform action**
- Verify all ProjectMemberRole records are created
- Check ProjectRolePermission table has the action mapped

---

**Last Updated:** March 22, 2026
**Status:** Production Ready
