const fs = require('fs');

// 1. project.service.ts
let service = fs.readFileSync('src/services/project.service.ts', 'utf8');
const searchMethod = `
  async searchProjectMembers(projectId: number, query: string) {
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
  }
};`;
service = service.replace(/};\s*$/s, searchMethod);
fs.writeFileSync('src/services/project.service.ts', service);

// 2. projects.controller.ts
let controller = fs.readFileSync('src/routes/projects/projects.controller.ts', 'utf8');
const searchController = `
export const searchProjectMembers = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const q = req.query.q as string || '';

  const users = await ProjectService.searchProjectMembers(projectId, q);
  return ok(res, users);
});
`;
controller += searchController;
fs.writeFileSync('src/routes/projects/projects.controller.ts', controller);

// 3. projects.routes.ts
let routes = fs.readFileSync('src/routes/projects/projects.routes.ts', 'utf8');
routes = routes.replace('getProjectMembers', 'getProjectMembers,\n  searchProjectMembers');

const searchRoute = `router.get('/:projectId/members/search', authenticate, authorize({
  scope: 'project',
  permission: PERMISSIONS.PROJECT.READ,
  scopeId: req => req.params.projectId as string,
}), searchProjectMembers);`;

routes = routes.replace("export default router;", searchRoute + "\n\nexport default router;");
fs.writeFileSync('src/routes/projects/projects.routes.ts', routes);

