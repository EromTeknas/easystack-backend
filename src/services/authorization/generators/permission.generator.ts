type PermissionMap<T extends Record<string, readonly string[]>> = {
  [R in keyof T as Uppercase<R & string>]: {
    [A in T[R][number] as Uppercase<A & string>]: `${R & string}:${A & string}`;
  };
};

export function generatePermissions<T extends Record<string, readonly string[]>>(
  config: T,
): PermissionMap<T> {
  const permissions = {} as PermissionMap<T>;

  for (const [resource, actions] of Object.entries(config)) {
    const resourceKey = resource.toUpperCase() as keyof PermissionMap<T>;

    permissions[resourceKey] = {} as PermissionMap<T>[typeof resourceKey];

    for (const action of actions) {
      permissions[resourceKey][
        action.toUpperCase() as keyof PermissionMap<T>[typeof resourceKey]
      ] = `${resource}:${action}` as never;
    }
  }

  return permissions;
}