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
    permissions: [...PermissionGroups.PROJECT_ADMIN_ALL],
  },

  PROJECT_EDITOR: {
    key: "PROJECT_EDITOR",
    name: "Editor",
    description: "Can create and modify project content.",
    permissions: [
      PERMISSIONS.PROJECT.READ, 
      PERMISSIONS.FEED.READ,
      PERMISSIONS.FEED.CREATE,
      PERMISSIONS.FEED.UPDATE,
      PERMISSIONS.LOCALIZATION.READ,
      PERMISSIONS.LOCALIZATION.CREATE,
      PERMISSIONS.LOCALIZATION.UPDATE,
      PERMISSIONS.LOCALIZATION.RELEASE,
      PERMISSIONS.ENVIRONMENT.READ,
      PERMISSIONS.DEPLOYMENT.READ,
      PERMISSIONS.ASSET.CREATE,
    ],
  },

  PROJECT_CONTRIBUTOR: {
    key: "PROJECT_CONTRIBUTOR",
    name: "Contributor",
    description: "Can contribute to the project content without creating new feed schemas.",
    permissions: [
      PERMISSIONS.PROJECT.READ,
      PERMISSIONS.FEED.READ,
      PERMISSIONS.LOCALIZATION.READ,
      PERMISSIONS.LOCALIZATION.UPDATE,
      PERMISSIONS.ENVIRONMENT.READ,
      PERMISSIONS.DEPLOYMENT.READ,
    ],
  },

  PROJECT_VIEWER: {
    key: "PROJECT_VIEWER",
    name: "Viewer",
    description: "Read-only access to the project.",
    permissions: [
      PERMISSIONS.PROJECT.READ,
      PERMISSIONS.FEED.READ,
      PERMISSIONS.LOCALIZATION.READ,
      PERMISSIONS.ENVIRONMENT.READ,
      PERMISSIONS.DEPLOYMENT.READ,
    ],
  },
} satisfies Record<string, RoleDefinition>;

export type ProjectRole = keyof typeof ProjectRoles;
