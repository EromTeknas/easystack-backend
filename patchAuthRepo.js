const fs = require('fs');
let content = fs.readFileSync('src/services/authorization/repositories/authorization.repository.ts', 'utf8');

const importAdd = `import { prisma } from "../../../db";\n`;
if (!content.includes('import { prisma }')) {
  content = importAdd + content;
}

const badProjectLoop = `    for (const workspaceMember of workspaceMembers) {
      const projectMembers = await findProjectsByUser(
        workspaceMember.userId,
      );

      for (const projectMember of projectMembers) {
        assignments.push({
          scope: "project",
          scopeId: projectMember.projectId.toString(),

          roles: [projectMember.role.key],

          permissions: projectMember.role.permissions.map(
            (rp) => rp.permission.key,
          ),

          customPermissions: [],

          deniedPermissions: [],
        });
      }
    }`;

const goodProjectLoop = `    for (const workspaceMember of workspaceMembers) {
      const projectMembers = await findProjectsByUser(
        workspaceMember.userId,
      );

      // Track which projects they have explicit assignments for
      const explicitProjectIds = new Set(projectMembers.map(pm => pm.projectId));

      for (const projectMember of projectMembers) {
        assignments.push({
          scope: "project",
          scopeId: projectMember.projectId.toString(),
          roles: [projectMember.role.key],
          permissions: projectMember.role.permissions.map((rp) => rp.permission.key),
          customPermissions: [],
          deniedPermissions: [],
        });
      }

      // IMPLICIT INHERITANCE: If Workspace Admin or Owner, inject all remaining projects in the workspace!
      if (workspaceMember.role.key === 'WORKSPACE_OWNER' || workspaceMember.role.key === 'WORKSPACE_ADMIN') {
        const allWorkspaceProjects = await prisma.project.findMany({
          where: { workspaceId: workspaceMember.workspaceId },
          select: { id: true }
        });

        // We need to give them the equivalent PROJECT role permissions.
        // We will fetch the PROJECT_ADMIN role from DB to get its exact permissions.
        const projectAdminRole = await prisma.role.findUnique({
          where: { key: workspaceMember.role.key === 'WORKSPACE_OWNER' ? 'PROJECT_OWNER' : 'PROJECT_ADMIN' },
          include: { permissions: { include: { permission: true } } }
        });

        if (projectAdminRole) {
          const adminPermissions = projectAdminRole.permissions.map(rp => rp.permission.key);
          
          for (const proj of allWorkspaceProjects) {
            if (!explicitProjectIds.has(proj.id)) {
              assignments.push({
                scope: "project",
                scopeId: proj.id.toString(),
                roles: [projectAdminRole.key],
                permissions: adminPermissions,
                customPermissions: [],
                deniedPermissions: [],
              });
            }
          }
        }
      }
    }`;

content = content.replace(badProjectLoop, goodProjectLoop);
fs.writeFileSync('src/services/authorization/repositories/authorization.repository.ts', content);
