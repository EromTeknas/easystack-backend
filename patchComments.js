const fs = require('fs');
let content = fs.readFileSync('src/services/collaboration.service.ts', 'utf8');

const badRoot = `      return {
        ...c,
        replyCount,
        author: user
      };`;

const goodRoot = `      const doc = {
        ...c,
        replyCount,
        author: user
      };
      if (doc.status === 'DELETED') {
        doc.content = null;
      }
      return doc;`;

const badReplies = `      return { ...c, author: user };`;
const goodReplies = `      const doc = { ...c, author: user };
      if (doc.status === 'DELETED') {
        doc.content = null;
      }
      return doc;`;

content = content.replace(badRoot, goodRoot);
content = content.replace(badReplies, goodReplies);

fs.writeFileSync('src/services/collaboration.service.ts', content);
