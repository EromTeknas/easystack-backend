const fs = require('fs');
let content = fs.readFileSync('src/services/project.service.ts', 'utf8');

const badGet = /async getProjectMembers\(projectId: number\).*?return \[\.\.\.results, \.\.\.privilegedResults\];\n  }/s;
const goodGet = `async getProjectMembers(projectId: number) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');

    return ProjectRepository.getAllAuthorizedProjectMembers(prisma, projectId);
  }`;
content = content.replace(badGet, goodGet);

fs.writeFileSync('src/services/project.service.ts', content);
