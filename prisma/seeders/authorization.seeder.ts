import { PrismaClient, RoleScope } from "@prisma/client";

import { PERMISSIONS } from "../../src/services/authorization/constants/permission.constants";
import { RoleRegistry } from "../../src/services/authorization/configs/roles-registry.config";

export async function seedAuthorization(prisma: PrismaClient) {
  console.log("🌱 Seeding Authorization...");

  await prisma.$transaction(async (tx) => {
    /*
     * --------------------------------------------------------------------------
     * Permissions
     * --------------------------------------------------------------------------
     */

    const permissionMap = new Map<string, number>();

    const permissions = Object.values(PERMISSIONS).flatMap((resource) =>
      Object.values(resource)
    );

    for (const permission of permissions) {
      const [resource, action] = permission.split(":") as [string, string];
      const dbPermission = await tx.permission.upsert({
        where: { key: permission },

        update: {
          resource,
          action,
        },

        create: {
          key: permission,
          resource,
          action,
        },
      });

      permissionMap.set(permission, dbPermission.id);
    }

    /*
     * --------------------------------------------------------------------------
     * Roles
     * --------------------------------------------------------------------------
     */

    for (const [scope, roles] of Object.entries(RoleRegistry)) {
      for (const [roleKey, role] of Object.entries(roles)) {
        const dbRole = await tx.role.upsert({
          where: {
            key: roleKey,
          },

          update: {
            name: role.name,
            description: role.description,
            scope: scope.toUpperCase() as RoleScope,
          },

          create: {
            key: roleKey,
            name: role.name,
            description: role.description,
            scope: scope.toUpperCase() as RoleScope,
            isSystem: true,
          },
        });

        await tx.rolePermission.deleteMany({
          where: {
            roleId: dbRole.id,
          },
        });

        await tx.rolePermission.createMany({
          data: role.permissions.map((permission) => ({
            roleId: dbRole.id,
            permissionId: permissionMap.get(permission)!,
          })),
          skipDuplicates: true,
        });
      }
    }
  });

  console.log("✅ Authorization Seeded");
}