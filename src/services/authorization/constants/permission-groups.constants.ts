import { RoleDefinition } from '../types/role-definition.type';
import { Permission, PERMISSIONS } from './permission.constants'

export const PermissionGroups = {
  WORKSPACE_ALL: Object.values(PERMISSIONS.WORKSPACE),

  PROJECT_ALL: Object.values(PERMISSIONS.PROJECT),
} satisfies Record<string, readonly Permission[]>;