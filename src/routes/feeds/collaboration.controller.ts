import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError } from '../../errors';
import { CollaborationService } from '../../services/collaboration.service';

export const requestReview = asyncHandler(async (req: any, res: Response) => {
  const workspaceId = Number(req.body.workspaceId || 1); // Mocked for now
  const projectId = Number(req.params.projectId);
  const feedId = Number(req.params.feedId);
  const language = req.params.language;
  const { reviewerIds, commentText } = req.body;
  const userId = req.user?.id || 1;

  if (!reviewerIds || !Array.isArray(reviewerIds) || reviewerIds.length === 0) {
    throw new BadRequestError('reviewerIds array is required');
  }

  const comment = await CollaborationService.requestReview(workspaceId, projectId, feedId, language, userId, reviewerIds, commentText);
  return ok(res, { message: 'Review requested', comment });
});

export const addReviewers = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const feedId = Number(req.params.feedId);
  const language = req.params.language;
  const commentId = req.params.commentId;
  const { reviewerIds } = req.body;
  const userId = req.user?.id || 1;

  if (!reviewerIds || !Array.isArray(reviewerIds) || reviewerIds.length === 0) {
    throw new BadRequestError('reviewerIds array is required');
  }

  const comment = await CollaborationService.addReviewers(projectId, feedId, language, commentId, userId, reviewerIds);
  return ok(res, { message: 'Reviewers added to thread', comment });
});

export const approveReview = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const feedId = Number(req.params.feedId);
  const language = req.params.language;
  const commentId = req.params.commentId;
  const userId = req.user?.id || 1;

  const comment = await CollaborationService.approveReview(projectId, feedId, language, commentId, userId);
  return ok(res, { message: 'Translation approved', comment });
});

export const createComment = asyncHandler(async (req: any, res: Response) => {
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
});


export const closeReview = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const feedId = Number(req.params.feedId);
  const language = req.params.language;
  const commentId = req.params.commentId;
  const userId = req.user?.id || 1;

  const comment = await CollaborationService.closeReview(projectId, feedId, language, commentId, userId);
  return ok(res, { message: 'Review request closed', comment });
});
