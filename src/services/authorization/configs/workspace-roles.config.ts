import { PERMISSIONS } from "../constants/permission.constants";
import { PermissionGroups } from "../constants/permission-groups.constants";
import { RoleDefinition } from "../types/role-definition.type";

export const WorkspaceRoles = {
  WORKSPACE_OWNER: {
    key: "WORKSPACE_OWNER",
    name: "Owner",
    description: "Can perform all operations inside the Workspace",
    permissions: [
      ...PermissionGroups.WORKSPACE_ALL,
      ...PermissionGroups.PROJECT_ALL
    ],
  },

  WORKSPACE_ADMIN: {
      key: "WORKSPACE_ADMIN",
      name: "Admin",
      description: "Can perform some operation inside the workspace",
      permissions: [
          ...PermissionGroups.PROJECT_ADMIN_ALL,
      PERMISSIONS.WORKSPACE.READ,
      PERMISSIONS.WORKSPACE.UPDATE,
      PERMISSIONS.WORKSPACE.INVITE,
      PERMISSIONS.WORKSPACE.MANAGE_MEMBERS,
    ],
  },

  WORKSPACE_MEMBER: {
    key: "WORKSPACE_MEMBER",
    name: "Member",
    description: "Can work on assigned projects.",
    permissions: [
      PERMISSIONS.WORKSPACE.READ,
      PERMISSIONS.PROJECT.CREATE,
    ],
  },

  WORKSPACE_VIEWER: {
    key: "WORKSPACE_VIEWER",
    name: "Viewer",
    description: "Read-only access.",
    permissions: [
      PERMISSIONS.WORKSPACE.READ,
    ],
  },

  WORKSPACE_GUEST: {
    key: "WORKSPACE_GUEST",
    name: "Guest",
    description: "External members invited only to specific projects. Cannot see other workspace members or projects.",
    permissions: [
      PERMISSIONS.WORKSPACE.READ
    ],
  },
} satisfies Record<string, RoleDefinition>;