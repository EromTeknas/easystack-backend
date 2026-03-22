/**
 * Project Roles & Permissions
 *
 * Project roles define what actions a user can perform within a specific project.
 * A user can have multiple project roles; permissions are the union of all assigned roles.
 *
 * Role hierarchy is NOT enforced—roles are permission bundles.
 * Users can have any combination of roles.
 */

export enum ProjectRoleEnum {
  EDITOR = 'EDITOR',
  PUBLISHER = 'PUBLISHER',
  RELEASE_MANAGER = 'RELEASE_MANAGER',
  VIEWER = 'VIEWER',
}

/**
 * Permission actions available within projects
 * Format: "project.resource.action"
 *
 * Scope:
 * - project.model.* → create, read, update, delete models/datasets
 * - project.content.* → create, read, update, delete content
 * - project.publish.* → publish and manage published content
 * - project.release.* → manage releases and deployments
 * - project.settings.* → view/modify project settings
 */
export enum ProjectPermissionAction {
  // Model/Schema Management
  MODEL_CREATE = 'project.model.create',
  MODEL_READ = 'project.model.read',
  MODEL_UPDATE = 'project.model.update',
  MODEL_DELETE = 'project.model.delete',

  // Content Management
  CONTENT_CREATE = 'project.content.create',
  CONTENT_READ = 'project.content.read',
  CONTENT_UPDATE = 'project.content.update',
  CONTENT_DELETE = 'project.content.delete',

  // Publishing
  PUBLISH = 'project.publish.publish',
  PUBLISH_UNPUBLISH = 'project.publish.unpublish',
  PUBLISH_READ = 'project.publish.read',

  // Release Management
  RELEASE_CREATE = 'project.release.create',
  RELEASE_DEPLOY = 'project.release.deploy',
  RELEASE_READ = 'project.release.read',

  // Project Settings
  SETTINGS_READ = 'project.settings.read',
  SETTINGS_UPDATE = 'project.settings.update',
  MEMBERS_VIEW = 'project.members.view',
}

/**
 * Role Permission Mapping
 * Defines what actions each project role can perform
 */
export const ROLE_PERMISSION_MAP: Record<ProjectRoleEnum, ProjectPermissionAction[]> = {
  [ProjectRoleEnum.EDITOR]: [
    ProjectPermissionAction.MODEL_CREATE,
    ProjectPermissionAction.MODEL_READ,
    ProjectPermissionAction.MODEL_UPDATE,
    ProjectPermissionAction.MODEL_DELETE,
    ProjectPermissionAction.CONTENT_CREATE,
    ProjectPermissionAction.CONTENT_READ,
    ProjectPermissionAction.CONTENT_UPDATE,
    ProjectPermissionAction.CONTENT_DELETE,
    ProjectPermissionAction.PUBLISH_READ,
    ProjectPermissionAction.SETTINGS_READ,
    ProjectPermissionAction.MEMBERS_VIEW,
  ],

  [ProjectRoleEnum.PUBLISHER]: [
    ProjectPermissionAction.MODEL_READ,
    ProjectPermissionAction.CONTENT_READ,
    ProjectPermissionAction.PUBLISH,
    ProjectPermissionAction.PUBLISH_UNPUBLISH,
    ProjectPermissionAction.PUBLISH_READ,
    ProjectPermissionAction.SETTINGS_READ,
    ProjectPermissionAction.MEMBERS_VIEW,
  ],

  [ProjectRoleEnum.RELEASE_MANAGER]: [
    ProjectPermissionAction.MODEL_READ,
    ProjectPermissionAction.CONTENT_READ,
    ProjectPermissionAction.RELEASE_CREATE,
    ProjectPermissionAction.RELEASE_DEPLOY,
    ProjectPermissionAction.RELEASE_READ,
    ProjectPermissionAction.SETTINGS_READ,
    ProjectPermissionAction.MEMBERS_VIEW,
  ],

  [ProjectRoleEnum.VIEWER]: [
    ProjectPermissionAction.MODEL_READ,
    ProjectPermissionAction.CONTENT_READ,
    ProjectPermissionAction.PUBLISH_READ,
    ProjectPermissionAction.RELEASE_READ,
    ProjectPermissionAction.SETTINGS_READ,
    ProjectPermissionAction.MEMBERS_VIEW,
  ],
};

/**
 * Helper: Get all unique permissions for a set of roles
 * Returns the union of permissions from all provided roles
 */
export function getPermissionsForRoles(roles: ProjectRoleEnum[]): Set<ProjectPermissionAction> {
  const permissions = new Set<ProjectPermissionAction>();

  for (const role of roles) {
    const rolePerms = ROLE_PERMISSION_MAP[role];
    if (rolePerms) {
      rolePerms.forEach((perm) => permissions.add(perm));
    }
  }

  return permissions;
}

/**
 * Helper: Check if a role can perform an action
 */
export function canRolePerform(
  role: ProjectRoleEnum,
  action: ProjectPermissionAction
): boolean {
  return ROLE_PERMISSION_MAP[role]?.includes(action) ?? false;
}
