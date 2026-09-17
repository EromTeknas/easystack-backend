import { Permission, PERMISSIONS } from './permission.constants'

export const PermissionGroups = {
  WORKSPACE_ALL: Object.values(PERMISSIONS.WORKSPACE),
  
  PROJECT_ALL: [
    ...Object.values(PERMISSIONS.PROJECT),
    ...Object.values(PERMISSIONS.PROJECT_MEMBER),
    ...Object.values(PERMISSIONS.FEED),
    ...Object.values(PERMISSIONS.LOCALIZATION),
    ...Object.values(PERMISSIONS.ENVIRONMENT),
    ...Object.values(PERMISSIONS.DEPLOYMENT),
    ...Object.values(PERMISSIONS.ASSET),
  ],

  PROJECT_ADMIN_ALL: [
    PERMISSIONS.PROJECT.READ,
    PERMISSIONS.PROJECT.UPDATE,
    ...Object.values(PERMISSIONS.PROJECT_MEMBER),
    ...Object.values(PERMISSIONS.FEED),
    ...Object.values(PERMISSIONS.LOCALIZATION),
    ...Object.values(PERMISSIONS.ENVIRONMENT),
    ...Object.values(PERMISSIONS.DEPLOYMENT),
    ...Object.values(PERMISSIONS.ASSET),
  ]
} satisfies Record<string, readonly Permission[]>;