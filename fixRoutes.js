const fs = require('fs');
let content = fs.readFileSync('src/routes/projects/projects.routes.ts', 'utf8');

// Fix imports
const badImport = `import {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
  updateProject,
  updateProjectLanguages,
  getProjectMembers
} from './projects.controller';`;

const goodImport = `import {
  createProject,
  deleteProject,
  getProjectById,
  listProjectsByWorkspace,
  updateProject,
  patchProject,
  getProjectLanguages,
  updateProjectLanguages,
  getProjectMembers
} from './projects.controller';`;

content = content.replace(badImport, goodImport);

// Fix the bad route
const badRoute = "router.get('/:projectId/members', authenticate, authorize(Permissions.READ_PROJECT), getProjectMembers);";
const goodRoute = `router.get('/:projectId/members', authenticate, authorize({
  scope: 'project',
  permission: PERMISSIONS.PROJECT.READ,
  scopeId: req => req.params.projectId as string,
}), getProjectMembers);`;

content = content.replace(badRoute, goodRoute);

fs.writeFileSync('src/routes/projects/projects.routes.ts', content);
