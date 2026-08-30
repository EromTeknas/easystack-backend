const fs = require('fs');
let content = fs.readFileSync('src/routes/feeds/feeds.routes.ts', 'utf8');

const badImport = `import { requestReview, respondToReview, addComment, resolveComment, getCollaborationData } from './collaboration.controller';`;
const goodImport = `import { requestReview, respondToReview, createComment, getRootComments, getReplies, updateComment, deleteComment, getCollaborationData } from './collaboration.controller';`;
content = content.replace(badImport, goodImport);

const badRoutes = `router.post('/:feedId/localizations/:language/comments', authenticate, addComment);
router.put('/:feedId/localizations/:language/comments/:commentId/resolve', authenticate, resolveComment);`;

const goodRoutes = `router.post('/:feedId/localizations/:language/comments', authenticate, createComment);
router.get('/:feedId/localizations/:language/comments', authenticate, getRootComments);
router.get('/:feedId/localizations/:language/comments/:commentId/replies', authenticate, getReplies);
router.patch('/:feedId/localizations/:language/comments/:commentId', authenticate, updateComment);
router.delete('/:feedId/localizations/:language/comments/:commentId', authenticate, deleteComment);`;

content = content.replace(badRoutes, goodRoutes);
fs.writeFileSync('src/routes/feeds/feeds.routes.ts', content);
