/**
 * Authorization & RBAC type definitions
 * Workspace-scoped permission model with custom overrides support
 */

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'USER';

export type PermissionAction =
  // Workspace operations
  | 'workspace.update.name'
  | 'workspace.update.logo'
  | 'workspace.delete'
  | 'workspace.members.add'
  | 'workspace.members.remove'
  | 'workspace.members.assign_role'
  // Project operations
  | 'project.create'
  | 'project.update.name'
  | 'project.delete'
  | 'project.members.add'
  | 'project.members.remove';

export interface WorkspaceMember {
  id: number;
  workspaceId: number;
  userId: number;
  role: WorkspaceRole;
  isActive: boolean;
  joinedAt: Date;
  updatedAt: Date;
}

export interface ProjectMember {
  id: number;
  projectId: number;
  workspaceId: number;
  userId: number;
  isActive: boolean;
  assignedAt: Date;
  assignedByUserId?: number;
}

export type PermissionResolutionReason =
  | 'owner_bypass'
  | 'custom_override'
  | 'role_default'
  | 'project_membership'
  | 'project_not_found'
  | 'not_workspace_member'
  | 'not_project_member'
  | 'no_project_roles'
  | 'project_role_permission'
  | 'permission_denied'
  | 'denied';

export interface PermissionResolution {
  allowed: boolean;
  reason: PermissionResolutionReason;
  resolvedAt: number; // timestamp in ms
}

export interface PermissionCheckOptions {
  throwOnDenied?: boolean; // default: true
  cache?: boolean; // default: false
}
