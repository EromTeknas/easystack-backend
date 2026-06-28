import { RoleRegistry, AuthorizationScope } from "../configs/roles-registry.config";

export interface ResolvePermissionsOptions {
  scope: AuthorizationScope;

  roles: string[];

  customPermissions: string[];

  deniedPermissions: string[];
}

export class PermissionResolver {
  static resolve({
    scope,
    roles,
    customPermissions = [],
    deniedPermissions = [],
  }: ResolvePermissionsOptions): string[] {
    const permissions = new Set<string>();

    const roleMap = RoleRegistry[scope];

    for (const role of roles) {
      const roleDefinition = roleMap[
        role as keyof typeof roleMap
      ];

      if (!roleDefinition) continue;

      for (const permission of roleDefinition.permissions) {
        permissions.add(permission);
      }
    }

    for (const permission of customPermissions) {
      permissions.add(permission);
    }

    for (const permission of deniedPermissions) {
      permissions.delete(permission);
    }

    return [...permissions];
  }
}