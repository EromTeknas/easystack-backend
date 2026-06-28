import { PermissionGroups } from "../constants/permission-groups.constants";
import { PERMISSIONS } from "../constants/permission.constants";
import { RoleDefinition } from "../types/role-definition.type";

export const ProjectRoles = {
  PROJECT_OWNER: {
    key: "PROJECT_OWNER",
    name: "Owner",
    description: "Full control over the project.",
    permissions: [...PermissionGroups.PROJECT_ALL],
  },

  PROJECT_ADMIN: {
    key: "PROJECT_ADMIN",
    name: "Admin",
    description: "Can manage the project and its members.",
    permissions: [...PermissionGroups.PROJECT_ALL],
  },

  PROJECT_EDITOR: {
    key: "PROJECT_EDITOR",
    name: "Editor",
    description: "Can create and modify project content.",
    permissions: [PERMISSIONS.PROJECT.READ, PERMISSIONS.PROJECT.UPDATE],
  },

  PROJECT_CONTRIBUTOR: {
    key: "PROJECT_CONTRIBUTOR",
    name: "Contributor",
    description: "Can contribute to the project.",
    permissions: [
      PERMISSIONS.PROJECT.READ,
      PERMISSIONS.PROJECT.CREATE,
      PERMISSIONS.PROJECT.UPDATE,
    ],
  },

  PROJECT_VIEWER: {
    key: "PROJECT_VIEWER",
    name: "Viewer",
    description: "Read-only access to the project.",
    permissions: [PERMISSIONS.PROJECT.READ],
  },
} satisfies Record<string, RoleDefinition>;

export type ProjectRole = keyof typeof ProjectRoles;
