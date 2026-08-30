const fs = require('fs');
let content = fs.readFileSync('src/services/project.service.ts', 'utf8');

const badMethod = `
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

// Remove the bad method and restore `};`
content = content.replace(badMethod, "};");

// Now safely append it inside `ProjectService`
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

const parts = content.split("};");
// The last item is empty or newline, the second to last is the end of the ProjectService object
if (parts.length >= 2) {
  parts[parts.length - 2] = parts[parts.length - 2] + newMethod;
  content = parts.slice(0, parts.length - 1).join("};"); // Join everything but the last split
}

fs.writeFileSync('src/services/project.service.ts', content);
