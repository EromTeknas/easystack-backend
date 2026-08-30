const fs = require('fs');
let content = fs.readFileSync('src/services/project.service.ts', 'utf8');

content = content.replace(/id: \{ notIn: Array\.from\(explicitMemberIds\) \},/g, 
  "...(explicitMemberIds.size > 0 ? { id: { notIn: Array.from(explicitMemberIds) } } : {}),");

fs.writeFileSync('src/services/project.service.ts', content);
