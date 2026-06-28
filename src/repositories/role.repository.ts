import { prisma } from "../db";
import { RoleScope } from "@prisma/client";

export function findById(id: number) {
    return prisma.role.findUnique({
        where: { id },
    });
}

export function findRoleByKey(scope: RoleScope, key: string) {
    return prisma.role.findUnique({
        where: { scope: scope, key: key  },
    });
}

export function findSystemRoles() {
    return prisma.role.findMany({
        where: { isSystem: true },
        orderBy: { id: "asc" },
    });
}

export function findCustomRoles(workspaceId: number) {
    return prisma.role.findMany({
        where: { workspaceId },
        orderBy: { id: "asc" },
    });
}

export function findAll() {
    return prisma.role.findMany({
        orderBy: { id: "asc" },
    });
}
