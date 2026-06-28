export interface ResolvePermissionsOptions {
  permissions: string[];

  customPermissions: string[];

  deniedPermissions: string[];
}

export class PermissionResolver {
  static resolve({
    permissions,
    customPermissions = [],
    deniedPermissions = [],
  }: ResolvePermissionsOptions): string[] {
    const resolved = new Set<string>(permissions);

    for (const permission of customPermissions) {
      resolved.add(permission);
    }

    for (const permission of deniedPermissions) {
      resolved.delete(permission);
    }

    return [...resolved];
  }
}