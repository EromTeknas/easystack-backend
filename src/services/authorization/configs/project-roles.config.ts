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
    description: "Can create and modify project content and schemas.",
    permissions: [
      PERMISSIONS.PROJECT.READ, 
      PERMISSIONS.SCHEMA.READ,
      PERMISSIONS.SCHEMA.CREATE,
      PERMISSIONS.SCHEMA.UPDATE,
      PERMISSIONS.CONTENT.READ,
      PERMISSIONS.CONTENT.CREATE,
      PERMISSIONS.CONTENT.UPDATE,
      PERMISSIONS.CONTENT.DELETE,
      PERMISSIONS.LOCALIZATION.READ,
      PERMISSIONS.LOCALIZATION.CREATE,
      PERMISSIONS.LOCALIZATION.UPDATE,
      PERMISSIONS.LOCALIZATION.RELEASE,
      PERMISSIONS.ENVIRONMENT.READ,
      PERMISSIONS.DEPLOYMENT.READ,
      PERMISSIONS.RELEASE.READ,
      PERMISSIONS.RELEASE.CREATE,
      PERMISSIONS.RELEASE.EXECUTE,
      PERMISSIONS.RELEASE.APPROVE,
      PERMISSIONS.RELEASE.DELETE,
      PERMISSIONS.ASSET.CREATE,
      PERMISSIONS.API_KEY.READ,
    ],
  },

  PROJECT_CONTRIBUTOR: {
    key: "PROJECT_CONTRIBUTOR",
    name: "Contributor",
    description: "Can contribute to project content without creating new schemas.",
    permissions: [
      PERMISSIONS.PROJECT.READ,
      PERMISSIONS.SCHEMA.READ,
      PERMISSIONS.CONTENT.READ,
      PERMISSIONS.CONTENT.CREATE,
      PERMISSIONS.CONTENT.UPDATE,
      PERMISSIONS.LOCALIZATION.READ,
      PERMISSIONS.LOCALIZATION.UPDATE,
      PERMISSIONS.ENVIRONMENT.READ,
      PERMISSIONS.DEPLOYMENT.READ,
      PERMISSIONS.RELEASE.READ,
    ],
  },

  PROJECT_VIEWER: {
    key: "PROJECT_VIEWER",
    name: "Viewer",
    description: "Read-only access to the project.",
    permissions: [
      PERMISSIONS.PROJECT.READ,
      PERMISSIONS.SCHEMA.READ,
      PERMISSIONS.CONTENT.READ,
      PERMISSIONS.LOCALIZATION.READ,
      PERMISSIONS.ENVIRONMENT.READ,
      PERMISSIONS.DEPLOYMENT.READ,
    ],
  },
} satisfies Record<string, RoleDefinition>;

export type ProjectRole = keyof typeof ProjectRoles;
