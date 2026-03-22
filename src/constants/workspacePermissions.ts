/**
 * Permission Constants
 * 
 * Centralized normalized permission actions to prevent typos and ensure consistency.
 * 
 * NAMING CONVENTION: resource.action (e.g., "workspace.members.add", "project.delete")
 * 
 * DESIGN PRINCIPLES:
 * - OWNER has implicit full access (not stored in RolePermission)
 * - Only ADMIN and USER defaults are stored
 * - Custom overrides per member stored in WorkspaceMemberPermission
 * - Backend enforces all checks (never trust frontend filtering)
 * 
 * PERMISSION RESOLUTION ORDER:
 * 1. Check workspace membership (user must be member)
 * 2. If OWNER role → grant all permissions (implicit)
 * 3. Check member-level overrides (explicit allow/deny)
 * 4. Fall back to role defaults (ADMIN or USER)
 * 
 * PRECEDENCE FOR CONFLICTS:
 * - Explicit member-level override always wins (allow or deny)
 * - Role defaults apply if no override exists
 * - Member overrides can grant additional permissions beyond role
 * - Member overrides can deny permissions that role would grant
 */

// ============================================================================
// Workspace Permissions (applies to entire workspace)
// ============================================================================

export const WORKSPACE_PERMISSIONS = {
  // Read workspace info
  READ: 'workspace.read' as const,

  // Modify workspace settings
  UPDATE_NAME: 'workspace.update.name' as const,
  UPDATE_LOGO: 'workspace.update.logo' as const,

  // Delete workspace (only OWNER)
  DELETE: 'workspace.delete' as const,

  // Manage workspace membership
  MEMBERS_ADD: 'workspace.members.add' as const,
  MEMBERS_REMOVE: 'workspace.members.remove' as const,
  MEMBERS_CHANGE_ROLE: 'workspace.members.change_role' as const,

  // Manage custom permissions per member
  PERMISSIONS_GRANT: 'workspace.permissions.grant' as const,
  PERMISSIONS_REVOKE: 'workspace.permissions.revoke' as const,
} as const;

// ============================================================================
// Project Permissions (applies to specific projects)
// ============================================================================

export const PROJECT_PERMISSIONS = {
  // Read project info
  READ: 'project.read' as const,

  // Modify project settings
  UPDATE_NAME: 'project.update.name' as const,
  UPDATE_DESCRIPTION: 'project.update.description' as const,

  // Delete project
  DELETE: 'project.delete' as const,

  // Manage project membership (assign/remove)
  MEMBERS_ADD: 'project.members.add' as const,
  MEMBERS_REMOVE: 'project.members.remove' as const,
} as const;

// ============================================================================
// Default Permissions by Role
// ============================================================================

/**
 * ADMIN default permissions
 * Can manage most aspects but cannot delete workspace or manage roles
 */
export const ADMIN_PERMISSIONS = [
  WORKSPACE_PERMISSIONS.READ,
  WORKSPACE_PERMISSIONS.UPDATE_NAME,
  WORKSPACE_PERMISSIONS.UPDATE_LOGO,
  WORKSPACE_PERMISSIONS.MEMBERS_ADD,
  WORKSPACE_PERMISSIONS.MEMBERS_REMOVE,
  WORKSPACE_PERMISSIONS.PERMISSIONS_GRANT,
  WORKSPACE_PERMISSIONS.PERMISSIONS_REVOKE,
  PROJECT_PERMISSIONS.READ,
  PROJECT_PERMISSIONS.UPDATE_NAME,
  PROJECT_PERMISSIONS.UPDATE_DESCRIPTION,
  PROJECT_PERMISSIONS.DELETE,
  PROJECT_PERMISSIONS.MEMBERS_ADD,
  PROJECT_PERMISSIONS.MEMBERS_REMOVE,
] as const;

/**
 * USER (MEMBER) default permissions
 * Can only read workspace and projects, cannot modify anything
 */
export const USER_PERMISSIONS = [
  WORKSPACE_PERMISSIONS.READ,
  PROJECT_PERMISSIONS.READ,
] as const;

/**
 * OWNER implicit permissions
 * OWNER has all permissions implicitly - no rows stored in RolePermission
 * This is a complete list for documentation purposes
 */
export const OWNER_PERMISSIONS = [
  ...ADMIN_PERMISSIONS,
  WORKSPACE_PERMISSIONS.DELETE,
  WORKSPACE_PERMISSIONS.MEMBERS_CHANGE_ROLE,
] as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Workspace-level permission actions
 * These control management of workspaces and workspace members
 */
export type WorkspacePermissionAction = typeof WORKSPACE_PERMISSIONS[keyof typeof WORKSPACE_PERMISSIONS];

/**
 * Project-management permission actions (at workspace level)
 * These are workspace-level permissions for managing projects within a workspace
 * Do NOT confuse with ProjectRolePermissionAction (for user actions within a project)
 */
export type WorkspaceProjectPermissionAction = typeof PROJECT_PERMISSIONS[keyof typeof PROJECT_PERMISSIONS];

/**
 * Union of all workspace-scoped permission actions
 */
export type PermissionAction = WorkspacePermissionAction | WorkspaceProjectPermissionAction;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get default permissions for a role
 * 
 * OWNER permissions are implicit (not stored in DB)
 * Only ADMIN and USER defaults are stored
 */
export function getDefaultPermissionsForRole(
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
): ReadonlyArray<PermissionAction> {
  switch (role) {
    case 'OWNER':
      // OWNER has implicit full access - this is never stored in DB
      // Return full list for reference/documentation only
      return OWNER_PERMISSIONS;
    case 'ADMIN':
      return ADMIN_PERMISSIONS;
    case 'MEMBER':
      return USER_PERMISSIONS;
  }
}

/**
 * Check if role can perform action (before member overrides are applied)
 * Used for role-level permission checks
 * 
 * IMPORTANT: This checks role defaults only, not including member overrides
 */
export function canRolePerformAction(
  role: 'OWNER' | 'ADMIN' | 'MEMBER',
  action: PermissionAction
): boolean {
  const permissions = getDefaultPermissionsForRole(role);
  return permissions.includes(action);
}

/**
 * Check if a permission is workspace-scoped
 */
export function isWorkspacePermission(action: PermissionAction): action is WorkspacePermissionAction {
  return action.startsWith('workspace.');
}

/**
 * Check if a permission is project-scoped (at workspace level)
 * Renamed from isProjectPermission to avoid confusion with project-role permissions
 */
export function isWorkspaceProjectPermission(action: PermissionAction): action is WorkspaceProjectPermissionAction {
  return action.startsWith('project.') && !action.includes('role');
}

/**
 * Get all permission actions for seeding
 */
export function getAllPermissionActions(): PermissionAction[] {
  return [
    ...Object.values(WORKSPACE_PERMISSIONS),
    ...Object.values(PROJECT_PERMISSIONS),
  ];
}
