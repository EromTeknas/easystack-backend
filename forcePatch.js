const fs = require('fs');
let content = fs.readFileSync('src/services/project.service.ts', 'utf8');

const startIndex = content.indexOf('async getProjectMembers(projectId: number) {');
const endIndex = content.indexOf(', async searchProjectMembers');

if (startIndex !== -1 && endIndex !== -1) {
  const goodGet = `async getProjectMembers(projectId: number) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');

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

    const results = projectMembers.map(pm => ({
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

    return [...results, ...privilegedResults];
  }

  `;
  content = content.substring(0, startIndex) + goodGet + content.substring(endIndex);
  fs.writeFileSync('src/services/project.service.ts', content);
  console.log("Successfully patched getProjectMembers");
} else {
  console.log("Could not find start or end index");
}
