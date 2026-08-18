import { prisma } from "../db";
import { Role } from "@prisma/client";

class RoleRepository {
  async getRolesByScope(scope: "WORKSPACE" | "PROJECT", excludeKey?: string) {
    const where: any = { scope };
    if (excludeKey) {
      where.key = { not: excludeKey };
    }

    return prisma.role.findMany({
      where,
      select: { id: true, key: true, name: true, description: true }
    });
  }

  async findById(id: number): Promise<Role | null> {
    return prisma.role.findUnique({ where: { id } });
  }

  async findWorkspaceRole(id: number, excludeKey?: string): Promise<Role | null> {
    const where: any = { id, scope: "WORKSPACE" };
    if (excludeKey) {
      where.key = { not: excludeKey };
    }
    return prisma.role.findFirst({ where });
  }
}

export default new RoleRepository();
