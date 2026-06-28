import { prisma } from "../../../db";

export function findPermissions(roleId: number) {
  return prisma.rolePermission.findMany({
    where: { roleId },
    include: {
      permission: true,
    },
  });
}

export function findRoles(permissionId: number) {
  return prisma.rolePermission.findMany({
    where: { permissionId },
  });
}

export function assignPermission(roleId: number, permissionId: number) {
  return prisma.rolePermission.create({
    data: { roleId, permissionId },
  });
}

export function removePermission(roleId: number, permissionId: number) {
  return prisma.rolePermission.delete({
    where: { roleId_permissionId: { roleId, permissionId } },
  });
}
