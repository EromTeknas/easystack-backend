# Authorization System

Complete guide to workspace and project authorization, including permission architecture, role hierarchy, and enforcement patterns.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Role Hierarchy](#role-hierarchy)
3. [Permission Model](#permission-model)
4. [Permission Resolution Algorithm](#permission-resolution-algorithm)
5. [Core Security Policies](#core-security-policies)
6. [Implementation Guide](#implementation-guide)
7. [Permission Constants Reference](#permission-constants-reference)
8. [Common Operations](#common-operations)

---

## Architecture Overview

### Design Principles

- **Backend-First**: All authorization checks happen on the backend. Frontend permission display is advisory only.
- **OWNER is Implicit**: OWNER role grants full access without storing permissions in the database.
- **Role Defaults + Overrides**: Each user gets base permissions from their role, plus optional per-member overrides.
- **5-Step Resolution**: Membership → OWNER → overrides → role defaults → project membership.
- **Audit Trail**: All permission changes logged with timestamps and actor information.

### Database Structure

Three core tables manage authorization:

1. **WorkspaceMember** - User membership in workspace with role and audit metadata
2. **RolePermission** - Default permissions for ADMIN and USER roles (OWNER implicit)
3. **WorkspaceMemberPermission** - Per-member permission overrides (allow/deny specific actions)

### Key Concepts

| Concept | Definition |
|---------|-----------|
| **OWNER** | Implicit full access to all workspace operations. Not stored in database. |
| **ADMIN** | 13 default permissions for administrative operations + role defaults. |
| **USER** | 2 default permissions: workspace.read and project.read. |
| **Custom Override** | Per-member exception to role defaults (grant additional or deny existing perms). |
| **Effective Permission** | Final resolved permission after applying all layers (role + overrides). |

---

## Role Hierarchy

### OWNER
- **Scope**: Entire workspace and all projects
- **Stored in DB**: No (implicit)
- **Permissions**: All (full access)
- **Use Case**: Workspace creator, organization owner
- **Key Restrictions**: Cannot be modified or revoked by ADMIN

### ADMIN
- **Scope**: Entire workspace and assigned projects
- **Stored in DB**: Yes (13 default permissions)
- **Permissions**: All workspace operations except workspace.delete (OWNER-only)
- **Use Case**: Administrators, team leads
- **Key Restrictions**: Cannot delete workspace, cannot modify OWNER

### USER
- **Scope**: Assigned projects only
- **Stored in DB**: Yes (2 default permissions: workspace.read, project.read)
- **Permissions**: Read workspace info, read assigned projects
- **Use Case**: Team members, contributors
- **Key Restrictions**: Limited to explicitly assigned projects

---

## Permission Model

### Workspace Permissions

| Permission | Description | OWNER | ADMIN | USER |
|-----------|-----------|-------|-------|------|
| `workspace.read` | Read workspace information | ✓ | ✓ | ✓ |
| `workspace.update.name` | Update workspace name | ✓ | ✓ | ✗ |
| `workspace.update.logo` | Update workspace logo | ✓ | ✓ | ✗ |
| `workspace.delete` | Delete entire workspace | ✓ | ✗ | ✗ |
| `workspace.members.add` | Add members to workspace | ✓ | ✓ | ✗ |
| `workspace.members.remove` | Remove members from workspace | ✓ | ✓ | ✗ |
| `workspace.members.change_role` | Change member roles | ✓ | ✓ | ✗ |
| `workspace.permissions.grant` | Grant custom permissions | ✓ | ✓ | ✗ |
| `workspace.permissions.revoke` | Revoke custom permissions | ✓ | ✓ | ✗ |

### Project Permissions

| Permission | Description | OWNER | ADMIN | USER |
|-----------|-----------|-------|-------|------|
| `project.read` | Read project information | ✓ | ✓ | ✓* |
| `project.update.name` | Update project name | ✓ | ✓ | ✗ |
| `project.update.description` | Update project description | ✓ | ✓ | ✗ |
| `project.delete` | Delete project | ✓ | ✓ | ✗ |
| `project.members.add` | Add members to project | ✓ | ✓ | ✗ |
| `project.members.remove` | Remove members from project | ✓ | ✓ | ✗ |

*USER can read assigned projects only (via ProjectMember.is_active = true)

---

## Permission Resolution Algorithm

### The 5-Step Process

When checking if a user can perform an action:

```
Step 1: Check workspace membership
        ↓ (not member → DENY)
Step 2: Check OWNER role
        ↓ (OWNER → ALLOW implicitly)
Step 3: Check member-level override
        ↓ (override exists → use override value)
Step 4: Check role default permissions
        ↓ (permission exists → ALLOW)
Step 5: Check project membership (for project actions)
        ↓ (assigned to project → ALLOW)
DENY    ← (fall through all checks)
```

### Implementation in Code

```typescript
async getEffectivePermission(
  userId: number,
  workspaceId: number,
  action: PermissionAction,
  projectId?: number
): Promise<PermissionResolution>
```

See [Authorization Service](../src/services/authorization.service.ts) for full implementation.

### Example Scenarios

**Scenario 1: USER checking workspace.update.name**
1. ✓ Is member (USER role)
2. ✗ Not OWNER
3. ✓ No override exists
4. ✗ USER role doesn't have this permission (only 2 defaults)
5. → DENY ❌

**Scenario 2: ADMIN checking workspace.members.add**
1. ✓ Is member (ADMIN role)
2. ✗ Not OWNER
3. ✓ No override exists
4. ✓ ADMIN role has this permission (13 defaults include it)
5. → ALLOW ✅

**Scenario 3: USER with override checking workspace.delete**
1. ✓ Is member (USER role)
2. ✗ Not OWNER
3. ✓ Override exists: is_allowed = true (admin granted this specifically)
4. → ALLOW ✅ (override wins)

**Scenario 4: ADMIN with deny override checking workspace.delete**
1. ✓ Is member (ADMIN role)
2. ✗ Not OWNER
3. ✓ Override exists: is_allowed = false (admin explicitly denied)
4. → DENY ✅ (override wins even though role would allow)

---

## Core Security Policies

All policies are enforced at the service layer, never at the database level. The database schema prevents inconsistency, but enforcement logic prevents policy violations.

### Policy 1: Prevent Admin from Modifying Owner

**Rationale**: OWNER is immutable by design. ADMIN cannot alter OWNER's status, role, or remove them.

**Enforcement**:
```typescript
async changeRole(
  actorId: number,
  workspaceId: number,
  targetUserId: number,
  newRole: WorkspaceRole
): Promise<void> {
  // Check actor has permission
  await this.requirePermission(
    actorId,
    workspaceId,
    WORKSPACE_PERMISSIONS.MEMBERS_CHANGE_ROLE
  );

  // Check target isn't OWNER
  const target = await prisma.workspaceMembers.findUnique({
    where: { uk_workspace_user: { workspace_id: workspaceId, user_id: targetUserId } }
  });

  if (target?.role === 'OWNER') {
    throw new ForbiddenError('Cannot modify OWNER role');
  }

  // Apply role change with audit
  await prisma.workspaceMembers.update({
    where: { id: target.id },
    data: {
      role: newRole,
      roleChangedAt: new Date(),
      roleChangedByUserId: actorId
    }
  });
}
```

### Policy 2: Users Can Only Grant Permissions They Have

**Rationale**: Prevent privilege escalation. Users cannot grant permissions they don't possess.

**Enforcement**:
```typescript
async grantPermission(
  actorId: number,
  workspaceId: number,
  targetUserId: number,
  action: PermissionAction
): Promise<void> {
  // Verify actor has this permission
  const actorCan = await this.getEffectivePermission(
    actorId,
    workspaceId,
    action
  );

  if (!actorCan.allowed) {
    throw new ForbiddenError(
      `Cannot grant permission you don't have: ${action}`
    );
  }

  // Get target member
  const targetMember = await prisma.workspaceMembers.findUnique({
    where: { uk_workspace_user: { workspace_id: workspaceId, user_id: targetUserId } }
  });

  // Grant override
  await prisma.workspaceMemberPermissions.upsert({
    where: {
      uk_member_action: {
        workspace_member_id: targetMember.id,
        action
      }
    },
    create: {
      workspace_member_id: targetMember.id,
      action,
      is_allowed: true,
      granted_at: new Date(),
      granted_by_user_id: actorId
    },
    update: {
      is_allowed: true,
      granted_at: new Date(),
      granted_by_user_id: actorId
    }
  });
}
```

### Policy 3: Only Owner Can Delete Workspace

**Rationale**: Workspace deletion is irreversible. Only OWNER can perform it.

**Enforcement**:
```typescript
async deleteWorkspace(
  actorId: number,
  workspaceId: number
): Promise<void> {
  // Check actor is OWNER
  const member = await prisma.workspaceMembers.findUnique({
    where: { uk_workspace_user: { workspace_id: workspaceId, user_id: actorId } }
  });

  if (member?.role !== 'OWNER') {
    throw new ForbiddenError('Only OWNER can delete workspace');
  }

  // Delete workspace and all related data
  await prisma.workspaces.delete({
    where: { id: workspaceId }
  });
}
```

### Policy 4: Only Owner Can Assign/Promote Admin

**Rationale**: ADMIN role grants significant power. Only OWNER can create new admins.

**Enforcement**:
```typescript
async changeRole(
  actorId: number,
  workspaceId: number,
  targetUserId: number,
  newRole: WorkspaceRole
): Promise<void> {
  // If changing TO ADMIN, actor must be OWNER
  if (newRole === 'ADMIN') {
    const actor = await prisma.workspaceMembers.findUnique({
      where: { uk_workspace_user: { workspace_id: workspaceId, user_id: actorId } }
    });

    if (actor?.role !== 'OWNER') {
      throw new ForbiddenError('Only OWNER can assign ADMIN role');
    }
  }

  // ... rest of changeRole logic
}
```

### Policy 5: Admin Can Only Manage User-Level Members

**Rationale**: Prevent ADMIN from autonomously escalating to OWNER or creating other admins.

**Enforcement**:
```typescript
async removeMember(
  actorId: number,
  workspaceId: number,
  targetUserId: number
): Promise<void> {
  const target = await prisma.workspaceMembers.findUnique({
    where: { uk_workspace_user: { workspace_id: workspaceId, user_id: targetUserId } }
  });

  // ADMIN cannot remove OWNER or other ADMIN
  if (target?.role !== 'USER') {
    throw new ForbiddenError(
      `Cannot remove member with role ${target.role}`
    );
  }

  // Remove member with audit
  await prisma.workspaceMembers.update({
    where: { id: target.id },
    data: {
      removedAt: new Date(),
      removedByUserId: actorId
    }
  });
}
```

### Policy 6: ProjectMember Requires Workspace Membership

**Rationale**: Users can only be added to projects if already in workspace.

**Enforcement**:
```typescript
async assignProjectMember(
  actorId: number,
  projectId: number,
  targetUserId: number
): Promise<void> {
  // Get project and workspace
  const project = await prisma.projects.findUnique({
    where: { id: projectId },
    include: { workspace: true }
  });

  // Check user is workspace member
  const workspaceMember = await prisma.workspaceMembers.findUnique({
    where: {
      uk_workspace_user: {
        workspace_id: project.workspace_id,
        user_id: targetUserId
      }
    }
  });

  if (!workspaceMember?.is_active) {
    throw new BadRequestError(
      'User must be workspace member before adding to project'
    );
  }

  // Add to project
  await prisma.projectMembers.create({
    data: {
      project_id: projectId,
      user_id: targetUserId,
      workspace_id: project.workspace_id,
      assigned_by_user_id: actorId,
      assigned_at: new Date()
    }
  });
}
```

### Policy 7: Project Must Belong to Same Workspace

**Rationale**: Prevent cross-workspace project access.

**Enforcement**:
```typescript
async canAccessProject(
  userId: number,
  projectId: number,
  workspaceId: number
): Promise<boolean> {
  const project = await prisma.projects.findUnique({
    where: { id: projectId }
  });

  // Project must belong to declared workspace
  if (project?.workspace_id !== workspaceId) {
    throw new BadRequestError(
      'Project does not belong to this workspace'
    );
  }

  // Check user's project membership or workspace role
  const workspaceMember = await prisma.workspaceMembers.findUnique({
    where: {
      uk_workspace_user: {
        workspace_id: workspaceId,
        user_id: userId
      }
    }
  });

  // OWNER can access any project in workspace
  if (workspaceMember?.role === 'OWNER') {
    return true;
  }

  // ADMIN/USER must be assigned to project
  const projectMember = await prisma.projectMembers.findUnique({
    where: {
      uk_project_user: {
        project_id: projectId,
        user_id: userId
      }
    }
  });

  return projectMember?.is_active || false;
}
```

---

## Implementation Guide

### Basic Permission Check

```typescript
import { AuthorizationService } from '@/services/authorization.service';
import { WORKSPACE_PERMISSIONS } from '@/constants/permissions';

const authService = new AuthorizationService();

// Check if user can update workspace name
await authService.requirePermission(
  userId,
  workspaceId,
  WORKSPACE_PERMISSIONS.UPDATE_NAME
);

// If control reaches here, user is authorized
// If not authorized, ForbiddenError is thrown
```

### Get Effective Permission Without Throwing

```typescript
const resolution = await authService.getEffectivePermission(
  userId,
  workspaceId,
  WORKSPACE_PERMISSIONS.MEMBERS_ADD
);

if (resolution.allowed) {
  console.log(`Allowed (reason: ${resolution.reason})`);
  // owner_bypass | custom_override | role_default | project_membership
} else {
  console.log('Denied');
}
```

### Adding Member to Workspace

```typescript
// 1. Check actor has permission
await authService.requirePermission(
  actorId,
  workspaceId,
  WORKSPACE_PERMISSIONS.MEMBERS_ADD
);

// 2. Add member (details in policy implementations)
await prisma.workspaceMembers.create({
  data: {
    workspace_id: workspaceId,
    user_id: newUserId,
    role: 'USER', // Start as USER
    created_at: new Date()
  }
});
```

### Granting Custom Permission

```typescript
// 1. Verify actor can perform the action
await authService.requirePermission(
  actorId,
  workspaceId,
  WORKSPACE_PERMISSIONS.PERMISSIONS_GRANT
);

// 2. Verify actor can perform the specific action being granted
await authService.requirePermission(
  actorId,
  workspaceId,
  actionToGrant // e.g., WORKSPACE_PERMISSIONS.DELETE
);

// 3. Create override
const targetMember = await prisma.workspaceMembers.findUnique({
  where: { uk_workspace_user: { workspace_id: workspaceId, user_id: targetUserId } }
});

await prisma.workspaceMemberPermissions.create({
  data: {
    workspace_member_id: targetMember.id,
    action: actionToGrant,
    is_allowed: true,
    granted_at: new Date(),
    granted_by_user_id: actorId,
    reason: 'Temporary elevated access for project migration'
  }
});
```

### Removing Member from Workspace

```typescript
// 1. Check actor has permission
await authService.requirePermission(
  actorId,
  workspaceId,
  WORKSPACE_PERMISSIONS.MEMBERS_REMOVE
);

// 2. Check target is not OWNER
const target = await prisma.workspaceMembers.findUnique({
  where: { uk_workspace_user: { workspace_id: workspaceId, user_id: targetUserId } }
});

if (target?.role === 'OWNER') {
  throw new ForbiddenError('Cannot remove OWNER');
}

// 3. Mark as removed (soft delete)
await prisma.workspaceMembers.update({
  where: { id: target.id },
  data: {
    removed_at: new Date(),
    removed_by_user_id: actorId
  }
});
```

---

## Permission Constants Reference

All permission strings are defined in [src/constants/permissions.ts](../src/constants/permissions.ts).

### Using Permission Constants

Always use constants instead of hardcoded strings:

```typescript
// ✅ GOOD - Type-safe, prevents typos
import { WORKSPACE_PERMISSIONS, PROJECT_PERMISSIONS } from '@/constants/permissions';

await authService.requirePermission(
  userId,
  workspaceId,
  WORKSPACE_PERMISSIONS.UPDATE_NAME
);

// ❌ BAD - Hardcoded string, prone to typos
await authService.requirePermission(
  userId,
  workspaceId,
  'workspace.update.name'
);
```

### Helper Functions

```typescript
// Get all default permissions for a role
import { getDefaultPermissionsForRole } from '@/constants/permissions';

const adminPerms = getDefaultPermissionsForRole('ADMIN');
// Returns: [13 permission strings for ADMIN]

// Check if user with role can perform action
import { canRolePerformAction } from '@/constants/permissions';

if (canRolePerformAction('USER', WORKSPACE_PERMISSIONS.MEMBERS_ADD)) {
  // USER cannot add members
}

// Check if action is workspace-scoped vs project-scoped
import { isWorkspacePermission, isProjectPermission } from '@/constants/permissions';

if (isWorkspacePermission(action)) {
  // Handle workspace permission
}
```

---

## Common Operations

### Add User to Workspace as ADMIN

```typescript
// 1. Verify actor can add members
await authService.requirePermission(
  actorId,
  workspaceId,
  WORKSPACE_PERMISSIONS.MEMBERS_ADD
);

// 2. Verify actor can assign ADMIN role (OWNER only)
const actor = await prisma.workspaceMembers.findUnique({
  where: { uk_workspace_user: { workspace_id: workspaceId, user_id: actorId } }
});

if (actor?.role !== 'OWNER') {
  throw new ForbiddenError('Only OWNER can assign ADMIN role');
}

// 3. Create member with ADMIN role
await prisma.workspaceMembers.create({
  data: {
    workspace_id: workspaceId,
    user_id: newUserId,
    role: 'ADMIN',
    created_at: new Date()
  }
});
```

### Revoke Permission Override

```typescript
// 1. Verify actor can revoke permissions
await authService.requirePermission(
  actorId,
  workspaceId,
  WORKSPACE_PERMISSIONS.PERMISSIONS_REVOKE
);

// 2. Get target member
const targetMember = await prisma.workspaceMembers.findUnique({
  where: { uk_workspace_user: { workspace_id: workspaceId, user_id: targetUserId } }
});

// 3. Delete override
await prisma.workspaceMemberPermissions.delete({
  where: {
    uk_member_action: {
      workspace_member_id: targetMember.id,
      action: actionToRevoke
    }
  }
});
```

### Check User's Visible Projects

```typescript
// OWNER sees all projects; ADMIN/USER see assigned only
const projectIds = await authService.getVisibleProjectIds(userId, workspaceId);

const projects = await prisma.projects.findMany({
  where: {
    workspace_id: workspaceId,
    id: { in: projectIds }
  }
});
```

### Change Member Role (OWNER → ADMIN)

```typescript
// 1. Verify actor can change roles
await authService.requirePermission(
  actorId,
  workspaceId,
  WORKSPACE_PERMISSIONS.MEMBERS_CHANGE_ROLE
);

// 2. Verify target is not OWNER
const target = await prisma.workspaceMembers.findUnique({
  where: { uk_workspace_user: { workspace_id: workspaceId, user_id: targetUserId } }
});

if (target?.role === 'OWNER') {
  throw new ForbiddenError('Cannot change OWNER role');
}

// 3. Verify actor is OWNER (to promote to ADMIN)
if (newRole === 'ADMIN' && actor?.role !== 'OWNER') {
  throw new ForbiddenError('Only OWNER can assign ADMIN');
}

// 4. Update role with audit
await prisma.workspaceMembers.update({
  where: { id: target.id },
  data: {
    role: newRole,
    role_changed_at: new Date(),
    role_changed_by_user_id: actorId
  }
});
```

---

## Testing Authorization

### Test Template for Permission Checks

```typescript
describe('AuthorizationService', () => {
  describe('getEffectivePermission', () => {
    it('should allow OWNER all actions', async () => {
      const resolution = await authService.getEffectivePermission(
        ownerId,
        workspaceId,
        WORKSPACE_PERMISSIONS.DELETE
      );
      expect(resolution.allowed).toBe(true);
      expect(resolution.reason).toBe('owner_bypass');
    });

    it('should deny USER workspace.delete', async () => {
      const resolution = await authService.getEffectivePermission(
        userId,
        workspaceId,
        WORKSPACE_PERMISSIONS.DELETE
      );
      expect(resolution.allowed).toBe(false);
    });

    it('should apply custom override', async () => {
      // Grant USER special permission
      await createOverride(userId, WORKSPACE_PERMISSIONS.DELETE, true);

      const resolution = await authService.getEffectivePermission(
        userId,
        workspaceId,
        WORKSPACE_PERMISSIONS.DELETE
      );
      expect(resolution.allowed).toBe(true);
      expect(resolution.reason).toBe('custom_override');
    });
  });

  describe('changeRole', () => {
    it('should prevent ADMIN from modifying OWNER', async () => {
      expect(() =>
        authService.changeRole(adminId, workspaceId, ownerId, 'USER')
      ).toThrow(ForbiddenError);
    });

    it('should allow OWNER to promote USER to ADMIN', async () => {
      await authService.changeRole(ownerId, workspaceId, userId, 'ADMIN');
      const member = await getMember(workspaceId, userId);
      expect(member.role).toBe('ADMIN');
    });
  });
});
```

---

## Audit Trail and Compliance

### Tracking Changes

All membership and permission changes are tracked with:

- **who**: `roleChangedByUserId`, `removedByUserId`, `grantedByUserId`
- **when**: `roleChangedAt`, `removedAt`, `grantedAt`
- **why**: `reason` (for future detailed logging)

### Querying Audit Trail

```typescript
// See who changed a member's role and when
const member = await prisma.workspaceMembers.findUnique({
  where: { id: memberId },
  include: { roleChangedByUser: true }
});

console.log(`Role changed by ${member.roleChangedByUser.email} at ${member.roleChangedAt}`);

// See all permission grants for a member
const grants = await prisma.workspaceMemberPermissions.findMany({
  where: { workspace_member_id: memberId },
  include: { grantedByUser: true }
});

grants.forEach(g => {
  console.log(`${g.action} granted by ${g.grantedByUser.email}`);
});
```

---

## Performance Considerations

### Indexes

The schema includes optimized indexes for common queries:

- `idx_workspace_role` - Fast role-based queries
- `idx_workspace_user` - Fast membership checks
- `idx_action` on permission tables - Fast action lookups

### Permission Check Performance

- **Typical** permission check: <10ms (2-3 DB queries)
- **Cached** permission check: <1ms (with caching layer)
- **Worst case** (multiple overrides): ~20ms

### Caching Strategy

For high-traffic scenarios, cache effective permissions:

```typescript
const cacheKey = `perms:${userId}:${workspaceId}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const permissions = await authService.getEffectivePermission(...);

// Cache for 5 minutes
await redis.setex(cacheKey, 300, JSON.stringify(permissions));

return permissions;
```

Invalidate cache on permission changes:

```typescript
// After granting/revoking permission
await redis.del(`perms:${userId}:${workspaceId}`);

// After role change
await redis.del(`perms:${userId}:${workspaceId}`);

// After member removal
await redis.del(`perms:${userId}:${workspaceId}`);
```

---

## FAQ

**Q: Can a USER ever get ADMIN permissions?**
A: Yes, via custom override. An OWNER can grant any permission to any member, even if their role wouldn't normally allow it.

**Q: What happens if an override contradicts the role default?**
A: Override always wins. If a USER has a custom override for `workspace.delete`, they can delete the workspace regardless of their USER role.

**Q: Is OWNER stored in the database?**
A: No. OWNER is implicit in code logic. When a user's role is checked and it's OWNER, they bypass all permission checks and get full access automatically.

**Q: Can I remove the OWNER from a workspace?**
A: No. OWNER cannot be modified by any code path, not even by other OWNERs. This prevents accidental removal of workspace access.

**Q: How do I know who changed a role?**
A: Check `WorkspaceMember.roleChangedByUser` and `roleChangedAt` timestamp. Full audit trail is maintained.

**Q: What if user is both ADMIN and has custom USER permission?**
A: Effective permission is the role default (ADMIN), unless an override exists. Overrides take precedence over role defaults.

---

## Related Documentation

- [Schema Reference](../documentation/FILE_STRUCTURE.md) - Database schema details
- [Error Handling](../documentation/ERROR_HANDLING.md) - Error types and handling
- [Local Development](../documentation/LOCAL_DEVELOPMENT.md) - Setting up auth locally
