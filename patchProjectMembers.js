const fs = require('fs');

// 1. Update projects.controller.ts
let controller = fs.readFileSync('src/routes/projects/projects.controller.ts', 'utf8');
const newControllerFunc = `
export const getProjectMembers = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  
  // Assuming ProjectService handles authorization check inside
  const members = await ProjectService.getProjectMembers(projectId);

  return ok(res, {
    members,
    message: 'Project members retrieved successfully'
  });
});
`;
controller += newControllerFunc;
fs.writeFileSync('src/routes/projects/projects.controller.ts', controller);

// 2. Update projects.routes.ts
let routes = fs.readFileSync('src/routes/projects/projects.routes.ts', 'utf8');

const importReplacement = `import {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
  updateProject,
  updateProjectLanguages,
  getProjectMembers
} from './projects.controller';`;
routes = routes.replace(/import {[^}]*?} from '\.\/projects.controller';/s, importReplacement);

const newRoute = `router.get('/:projectId/members', authenticate, authorize(Permissions.READ_PROJECT), getProjectMembers);`;
routes = routes.replace("export default router;", newRoute + "\\n\\nexport default router;");
fs.writeFileSync('src/routes/projects/projects.routes.ts', routes);

