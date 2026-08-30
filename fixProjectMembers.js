const fs = require('fs');
let content = fs.readFileSync('src/services/project.service.ts', 'utf8');

const oldGet = `  async getProjectMembers(projectId: number) {
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
  }`;

const newGet = `  async getProjectMembers(projectId: number) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');

    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        role: true,
        workspaceMember: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, resourceId: true }
            }
          }
        }
      }
    });

    const explicitMemberIds = new Set(projectMembers.map(pm => pm.workspaceMember.id));

    // Get privileged workspace members (Owner, Admin) who implicitly have access
    const privilegedWorkspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        id: { notIn: Array.from(explicitMemberIds) },
        role: {
          key: {
            in: [APP_ROLES.WORKSPACE.WORKSPACE_OWNER, APP_ROLES.WORKSPACE.WORKSPACE_ADMIN]
          }
        }
      },
      include: {
        role: true,
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, resourceId: true }
        }
      }
    });

    const results = projectMembers.map(pm => ({
      projectMemberId: pm.id,
      role: pm.role.name,
      joinedAt: pm.joinedAt,
      user: pm.workspaceMember.user
    }));

    const privilegedResults = privilegedWorkspaceMembers.map(wm => ({
      projectMemberId: null, // They are workspace members, not explicit project members
      role: wm.role.name,
      joinedAt: wm.joinedAt,
      user: wm.user
    }));

    return [...results, ...privilegedResults];
  }`;

const oldSearch = `, async searchProjectMembers(projectId: number, query: string) {
    const projectMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        workspaceMember: {
          user: {
            OR: [
              { firstName: { contains: query } },
              { lastName: { contains: query } },
              { email: { contains: query } }
            ]
          }
        }
      },
      include: {
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
      },
      take: 10
    });

    return projectMembers.map(pm => pm.workspaceMember.user);
  }`;

const newSearch = `, async searchProjectMembers(projectId: number, query: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');

    const projectMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        workspaceMember: {
          user: {
            OR: [
              { firstName: { contains: query } },
              { lastName: { contains: query } },
              { email: { contains: query } }
            ]
          }
        }
      },
      include: {
        workspaceMember: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, resourceId: true } }
          }
        }
      },
      take: 10
    });

    const explicitMemberIds = new Set(projectMembers.map(pm => pm.workspaceMember.id));

    const privilegedWorkspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        id: { notIn: Array.from(explicitMemberIds) },
        role: {
          key: {
            in: [APP_ROLES.WORKSPACE.WORKSPACE_OWNER, APP_ROLES.WORKSPACE.WORKSPACE_ADMIN]
          }
        },
        user: {
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { email: { contains: query } }
          ]
        }
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, resourceId: true } }
      },
      take: 10
    });

    const explicitUsers = projectMembers.map(pm => pm.workspaceMember.user);
    const privilegedUsers = privilegedWorkspaceMembers.map(wm => wm.user);

    // Limit to 10 total results
    return [...explicitUsers, ...privilegedUsers].slice(0, 10);
  }`;

content = content.replace(oldGet, newGet);
content = content.replace(oldSearch, newSearch);

fs.writeFileSync('src/services/project.service.ts', content);
