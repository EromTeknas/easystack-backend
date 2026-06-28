import { prisma } from "../../../db";

export function findById(id: number) {
  return prisma.permission.findUnique({
    where: { id },
  });
}

export function findByKey(key: string) {
    return prisma.permission.findUnique({
        where: { key },
    });
}

export function findAll() {
  return prisma.permission.findMany({
    orderBy: { id: "asc" },
  });
}

export function findMany(keys: string[]) {
  return prisma.permission.findMany({
    where: {
      key: {
        in: keys
      }
    }
  });
}