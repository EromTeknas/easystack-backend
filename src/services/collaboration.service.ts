import { prisma } from '../db';
import { FeedLocalization } from '../models/feed-localization.model';
import { FeedReviewRequest } from '../models/feed-review-request.model';
import { FeedComment } from '../models/feed-comment.model';
import { FeedAuditLog } from '../models/feed-audit-log.model';
import { NotFoundError, BadRequestError } from '../errors';

export const CollaborationService = {
  
  async getActiveLocalization(projectId: number, feedId: number, language: string) {
    const devEnvState = await prisma.environmentState.findFirst({
      where: { feedId, feed: { projectId }, environment: { name: 'development' } }
    });
    if (!devEnvState) throw new NotFoundError('Feed not found or no active development draft');

    const loc = await FeedLocalization.findOne({ feedVersionId: devEnvState.activeVersionId, languageCode: language });
    if (!loc) throw new NotFoundError('Localization not found');
    
    return { loc, activeVersionId: devEnvState.activeVersionId };
  },

  async requestReview(projectId: number, feedId: number, language: string, requesterUserId: number, requestedUserId: number) {
    const { loc, activeVersionId } = await this.getActiveLocalization(projectId, feedId, language);

    // Verify user exists in MySQL
    const user = await prisma.user.findUnique({ where: { id: requestedUserId } });
    if (!user) throw new BadRequestError('Requested user does not exist');

    let request = await FeedReviewRequest.findOne({ feedLocalizationId: loc._id, requestedUserId });
    if (request) {
      // Re-open if it was previously approved
      request.status = 'PENDING';
      await request.save();
    } else {
      request = await FeedReviewRequest.create({
        feedLocalizationId: loc._id,
        requestedUserId,
        requestedByUserId: requesterUserId,
        status: 'PENDING'
      });
    }

    // Mock Email sending
    console.log(`[EMAIL MOCK] Sending email to User ${requestedUserId} for feed ${feedId} (${language})`);
    console.log(`[EMAIL MOCK] Subject: Review Requested - Feed ${feedId}`);
    console.log(`[EMAIL MOCK] Body: User ${requesterUserId} has requested your review on the ${language.toUpperCase()} translation for Feed ${feedId}.`);

    await FeedAuditLog.create({
      feedId,
      feedVersionId: activeVersionId,
      userId: requesterUserId,
      action: 'REQUESTED_REVIEW' as any,
      languageCode: language,
      notes: `Requested review from User ID ${requestedUserId}`
    });

    return request;
  },

  async respondToReview(projectId: number, feedId: number, language: string, reviewerUserId: number, status: 'APPROVED' | 'CHANGES_REQUESTED') {
    const { loc, activeVersionId } = await this.getActiveLocalization(projectId, feedId, language);

    const request = await FeedReviewRequest.findOne({ feedLocalizationId: loc._id, requestedUserId: reviewerUserId });
    if (!request) throw new BadRequestError('You were not requested to review this translation');

    request.status = status;
    await request.save();

    await FeedAuditLog.create({
      feedId,
      feedVersionId: activeVersionId,
      userId: reviewerUserId,
      action: status === 'APPROVED' ? 'APPROVED_TRANSLATION' as any : 'REQUESTED_CHANGES' as any,
      languageCode: language,
      notes: `Reviewer marked translation as ${status}`
    });

    return request;
  },

    async createComment(workspaceId: number, projectId: number, feedId: number, language: string, authorId: number, payload: { content: any; mentions?: number[]; parentId?: string; jsonPath?: string }) {
    const { loc, activeVersionId } = await this.getActiveLocalization(projectId, feedId, language);

    if (payload.parentId) {
      const parent = await FeedComment.findById(payload.parentId);
      if (!parent || parent.feedLocalizationId.toString() !== loc._id.toString()) {
        throw new BadRequestError('Invalid parent comment');
      }
    }

    const createPayload: any = {
      workspaceId,
      projectId,
      feedLocalizationId: loc._id,
      authorId,
      parentId: payload.parentId || null,
      content: payload.content,
      mentions: payload.mentions || [],
      status: 'ACTIVE'
    };
    if (payload.jsonPath) {
      createPayload.jsonPath = payload.jsonPath;
    }

    const comment = await FeedComment.create(createPayload);

    // Mock BullMQ Job Trigger
    if (payload.mentions && payload.mentions.length > 0) {
      console.log(`[BULLMQ MOCK] Queued COMMENT_MENTION job for comment ${comment._id} targeting users: ${payload.mentions.join(', ')}`);
    }

    await FeedAuditLog.create({
      feedId,
      feedVersionId: activeVersionId,
      userId: authorId,
      action: 'ADDED_COMMENT' as any,
      languageCode: language,
      notes: `Added a comment`
    });

    return comment;
  },

  async getRootComments(projectId: number, feedId: number, language: string, limit = 20, cursor?: string) {
    const { loc } = await this.getActiveLocalization(projectId, feedId, language);

    const query: any = { feedLocalizationId: loc._id, parentId: null };
    if (cursor) {
      query._id = { $lt: cursor }; // basic cursor pagination
    }

    const comments = await FeedComment.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Fetch reply counts and user info (mocking user info fetch here for simplicity)
    const enriched = await Promise.all(comments.map(async (c) => {
      const replyCount = await FeedComment.countDocuments({ parentId: c._id });
      const user = await prisma.user.findUnique({ where: { id: c.authorId }, select: { id: true, firstName: true, lastName: true } });
      const doc = {
        ...c,
        replyCount,
        author: user
      };
      if (doc.status === 'DELETED') {
        doc.content = null;
      }
      return doc;
    }));

    return enriched;
  },

  async getReplies(commentId: string, limit = 20, cursor?: string) {
    const parent = await FeedComment.findById(commentId);
    if (!parent) throw new NotFoundError('Parent comment not found');

    const query: any = { parentId: commentId };
    if (cursor) {
      query._id = { $gt: cursor };
    }

    const replies = await FeedComment.find(query)
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    const enriched = await Promise.all(replies.map(async (c) => {
      const user = await prisma.user.findUnique({ where: { id: c.authorId }, select: { id: true, firstName: true, lastName: true } });
      const doc = { ...c, author: user };
      if (doc.status === 'DELETED') {
        doc.content = null;
      }
      return doc;
    }));

    return enriched;
  },

  async updateComment(commentId: string, authorId: number, content: any, mentions?: number[]) {
    const comment = await FeedComment.findById(commentId);
    if (!comment) throw new NotFoundError('Comment not found');
    if (comment.authorId !== authorId) throw new BadRequestError('Not authorized to edit this comment');
    if (comment.status === 'DELETED') throw new BadRequestError('Cannot edit deleted comment');

    comment.content = content;
    if (mentions) comment.mentions = mentions;
    comment.edited = true;
    await comment.save();

    return comment;
  },

  async deleteComment(commentId: string, userId: number) {
    const comment = await FeedComment.findById(commentId);
    if (!comment) throw new NotFoundError('Comment not found');
    if (comment.authorId !== userId) throw new BadRequestError('Not authorized to delete this comment');

    comment.status = 'DELETED';
    comment.deletedAt = new Date();
    comment.deletedBy = userId;
    await comment.save();

    return comment;
  },

  async getCollaborationData(projectId: number, feedId: number, language: string) {
    const { loc } = await this.getActiveLocalization(projectId, feedId, language);

    const reviews = await FeedReviewRequest.find({ feedLocalizationId: loc._id }).lean();
    const comments = await FeedComment.find({ feedLocalizationId: loc._id }).lean();

    return { reviews, comments };
  }
};
