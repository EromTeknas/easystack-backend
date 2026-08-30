const fs = require('fs');
let content = fs.readFileSync('src/routes/feeds/collaboration.controller.ts', 'utf8');

const badController = `export const addComment = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const feedId = Number(req.params.feedId);
  const language = req.params.language;
  const { jsonPath, message } = req.body;
  const userId = req.user?.id || 1;

  if (!jsonPath || !message) throw new BadRequestError('jsonPath and message are required');

  const comment = await CollaborationService.addComment(projectId, feedId, language, userId, jsonPath, message);
  return ok(res, { message: 'Comment added', comment });
});

export const resolveComment = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const feedId = Number(req.params.feedId);
  const language = req.params.language;
  const commentId = req.params.commentId;
  const userId = req.user?.id || 1;

  const comment = await CollaborationService.resolveComment(projectId, feedId, language, userId, commentId);
  return ok(res, { message: 'Comment resolved', comment });
});`;

const newController = `export const createComment = asyncHandler(async (req: any, res: Response) => {
  const workspaceId = Number(req.body.workspaceId || 1); // Mocked for now, should be from path/auth
  const projectId = Number(req.params.projectId);
  const feedId = Number(req.params.feedId);
  const language = req.params.language;
  const userId = req.user?.id || 1;
  const { content, mentions, parentId, jsonPath } = req.body;

  if (!content) throw new BadRequestError('content is required');

  const comment = await CollaborationService.createComment(workspaceId, projectId, feedId, language, userId, { content, mentions, parentId, jsonPath });
  return ok(res, { message: 'Comment created', comment });
});

export const getRootComments = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const feedId = Number(req.params.feedId);
  const language = req.params.language;
  const limit = Number(req.query.limit) || 20;
  const cursor = req.query.cursor as string;

  const comments = await CollaborationService.getRootComments(projectId, feedId, language, limit, cursor);
  return ok(res, comments);
});

export const getReplies = asyncHandler(async (req: any, res: Response) => {
  const commentId = req.params.commentId;
  const limit = Number(req.query.limit) || 20;
  const cursor = req.query.cursor as string;

  const replies = await CollaborationService.getReplies(commentId, limit, cursor);
  return ok(res, replies);
});

export const updateComment = asyncHandler(async (req: any, res: Response) => {
  const commentId = req.params.commentId;
  const userId = req.user?.id || 1;
  const { content, mentions } = req.body;

  if (!content) throw new BadRequestError('content is required');

  const comment = await CollaborationService.updateComment(commentId, userId, content, mentions);
  return ok(res, { message: 'Comment updated', comment });
});

export const deleteComment = asyncHandler(async (req: any, res: Response) => {
  const commentId = req.params.commentId;
  const userId = req.user?.id || 1;

  const comment = await CollaborationService.deleteComment(commentId, userId);
  return ok(res, { message: 'Comment deleted', comment });
});`;

content = content.replace(/export const addComment.*return ok\(res, { message: 'Comment resolved', comment }\);\n}\);/s, newController);
fs.writeFileSync('src/routes/feeds/collaboration.controller.ts', content);
