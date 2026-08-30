const fs = require('fs');

// 1. Add to ProjectRepository
let repo = fs.readFileSync('src/repositories/project.repository.ts', 'utf8');

const newMethod = `
  static async getAllAuthorizedProjectMembers(prisma: Prisma.TransactionClient, projectId: number) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return [];

    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        role: true,
        workspaceMember: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, resourceId: true } }
          }
        }
      }
    });

    const explicitMemberIds = projectMembers.map(pm => pm.workspaceMember.id);

    const privilegedWorkspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        ...(explicitMemberIds.length > 0 ? { id: { notIn: explicitMemberIds } } : {}),
        role: {
          key: {
            in: ['WORKSPACE_OWNER', 'WORKSPACE_ADMIN']
          }
        }
      },
      include: {
        role: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true, resourceId: true } }
      }
    });

    const explicitResults = projectMembers.map(pm => ({
      projectMemberId: pm.id,
      role: pm.role.name,
      joinedAt: pm.joinedAt,
      user: pm.workspaceMember.user
    }));

    const privilegedResults = privilegedWorkspaceMembers.map(wm => ({
      projectMemberId: null,
      role: wm.role.name,
      joinedAt: wm.joinedAt,
      user: wm.user
    }));

    return [...explicitResults, ...privilegedResults];
  }
}
`;

repo = repo.replace(/}\n*$/, newMethod);
fs.writeFileSync('src/repositories/project.repository.ts', repo);
