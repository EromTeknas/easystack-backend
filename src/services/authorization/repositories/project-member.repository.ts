import { prisma } from "../../../db";

export function findByProjectAndWorkspaceMember(
  projectId: number,
  workspaceMemberId: number
) {
  return prisma.projectMember.findUnique({
    where: {
      projectId_workspaceMemberId: {
        projectId,
        workspaceMemberId,
      },
      removedAt: null,
      workspaceMember: { removedAt: null }
    },
    include: {
      role: true,
    },
  });
}

export function findProjectsByUser(userId: number) {
  return prisma.projectMember.findMany({
    where: {
      workspaceMember: {
        userId,
        removedAt: null
      },
      removedAt: null
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });
}