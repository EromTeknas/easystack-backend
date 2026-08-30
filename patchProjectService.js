const fs = require('fs');
let content = fs.readFileSync('src/services/project.service.ts', 'utf8');

const newMethod = `
  async getProjectMembers(projectId: number) {
    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        role: true,
        workspaceMember: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                resourceId: true
              }
            }
          }
        }
      }
    });

    return projectMembers.map(pm => ({
      projectMemberId: pm.id,
      role: pm.role.name,
      joinedAt: pm.joinedAt,
      user: pm.workspaceMember.user
    }));
  }
};`;

content = content.replace("};", newMethod);
fs.writeFileSync('src/services/project.service.ts', content);
