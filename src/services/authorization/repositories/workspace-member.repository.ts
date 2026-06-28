import { prisma } from "../../../db";

export function findByWorkspaceAndUser(
  workspaceId: number,
  userId: number
) {
  return prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      role: true,
    },
  });
}

export function findWorkspacesByUser(userId: number) {
  return prisma.workspaceMember.findMany({
    where: {
      userId,
      removedAt: null,
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        }
      },
    },
  });
}