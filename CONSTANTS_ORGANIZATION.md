# Constants File Organization

## File Structure

```
src/constants/
├── index.ts                      # Central re-export hub
├── workspacePermissions.ts       # Workspace & workspace-level permissions
├── projectRoles.ts              # Project roles & project-level permissions
├── errorCodes.ts                # Error code constants
├── billing.ts                   # Billing plan constants
└── queues.ts                    # Job queue constants
```

## Naming Convention

### Authorization/Permissions Files

| File | Purpose | Types | Constants |
|------|---------|-------|-----------|
| `workspacePermissions.ts` | **Workspace-scoped** permissions | `WorkspacePermissionAction`, `WorkspaceProjectPermissionAction`, `PermissionAction` | `WORKSPACE_PERMISSIONS`, `PROJECT_PERMISSIONS`, `ADMIN_PERMISSIONS`, `USER_PERMISSIONS`, `OWNER_PERMISSIONS` |
| `projectRoles.ts` | **Project-scoped** roles & permissions | `ProjectRoleEnum`, `ProjectPermissionAction` | `ROLE_PERMISSION_MAP`, `getPermissionsForRoles()` |

### Key Distinction

- **`WorkspacePermissionAction`** — Actions on workspace itself (e.g., `workspace.update.name`)
- **`WorkspaceProjectPermissionAction`** — Workspace-level actions on projects (e.g., `project.members.add`)
- **`ProjectPermissionAction`** — User actions within a project (e.g., `project.model.create`)

## Import Patterns

### From Index (Recommended)
```typescript
import {
  WORKSPACE_PERMISSIONS,
  WorkspacePermissionAction,
  ProjectRoleEnum,
  ProjectPermissionAction,
} from '../constants';
```

### Direct Imports
```typescript
import { WORKSPACE_PERMISSIONS } from '../constants/workspacePermissions';
import { ProjectRoleEnum } from '../constants/projectRoles';
```

## Migration Notes

- **Renamed**: `permissions.ts` → `workspacePermissions.ts` (clarity)
- **Renamed**: `ProjectPermissionAction` (workspace level) → `WorkspaceProjectPermissionAction`
- **Kept**: `ProjectPermissionAction` (project level) in `projectRoles.ts`
- **New**: `src/constants/index.ts` for centralized exports

## Why This Organization?

1. **Clear Separation**: Workspace vs. project authorization are distinct concepts
2. **No Naming Conflicts**: Different permission action types clearly named
3. **Scalability**: Easy to add new constant categories
4. **Discoverability**: Central `index.ts` shows all exports
5. **Performance**: Tree-shaking friendly with `export *`

---

**Last Updated:** March 22, 2026
