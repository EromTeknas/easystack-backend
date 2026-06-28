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
      },
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