const fs = require('fs');
let content = fs.readFileSync('src/routes/feeds/feeds.routes.ts', 'utf8');

const importStatement = `import { requestReview, respondToReview, addComment, resolveComment, getCollaborationData } from './collaboration.controller';`;
content = importStatement + '\\n' + content;

const newRoutes = `
// Collaboration Routes (Reviews & Comments)
router.post('/:feedId/localizations/:language/reviews', authenticate, requestReview);
router.put('/:feedId/localizations/:language/reviews/status', authenticate, respondToReview);
router.post('/:feedId/localizations/:language/comments', authenticate, addComment);
router.put('/:feedId/localizations/:language/comments/:commentId/resolve', authenticate, resolveComment);
router.get('/:feedId/localizations/:language/collaboration', authenticate, getCollaborationData);

export default router;`;

content = content.replace("export default router;", newRoutes);
fs.writeFileSync('src/routes/feeds/feeds.routes.ts', content);
