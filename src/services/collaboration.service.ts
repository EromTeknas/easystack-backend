import { prisma } from '../db';
import { FeedLocalization } from '../models/feed-localization.model';
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

      async closeReview(projectId: number, feedId: number, language: string, commentId: string, userId: number) {
    const { loc } = await this.getActiveLocalization(projectId, feedId, language);
    const comment = await FeedComment.findOne({ _id: commentId, feedLocalizationId: loc._id, type: 'REVIEW_REQUEST' });
    if (!comment) throw new NotFoundError('Review request thread not found');
    if (comment.status !== 'ACTIVE') throw new BadRequestError('Review request is not active');

    comment.status = 'OUTDATED';
    await comment.save();

    const author = await prisma.user.findUnique({ where: { id: userId } });
    await FeedComment.create({
      workspaceId: comment.workspaceId,
      projectId,
      feedLocalizationId: loc._id,
      authorId: -1,
      parentId: comment._id,
      type: 'GENERAL',
      isSystem: true,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: userId.toString(), label: author?.firstName || 'System' } }, { type: 'text', text: ' closed this review request.' }] }] },
      mentions: [],
      status: 'ACTIVE'
    });

    return comment;
  },

  async requestReview(workspaceId: number, projectId: number, feedId: number, language: string, requesterUserId: number, reviewerIds: number[], commentText?: string) {
    const { loc, activeVersionId } = await this.getActiveLocalization(projectId, feedId, language);

    // Enforce ONE active review request at a time
    const existing = await FeedComment.findOne({ feedLocalizationId: loc._id, type: 'REVIEW_REQUEST', status: 'ACTIVE' });
    if (existing) {
      throw new BadRequestError('A review request is already in progress. Please use addReviewers endpoint to add more people to the existing thread.');
    }

    // Verify users exist
    const users = await prisma.user.findMany({ where: { id: { in: reviewerIds } } });
    if (users.length !== reviewerIds.length) {
      throw new BadRequestError('One or more requested users do not exist');
    }

    const author = await prisma.user.findUnique({ where: { id: requesterUserId } });

    // Build default Tiptap content
    const mentions = users.map(u => ({
      type: 'mention',
      attrs: { id: u.id.toString(), label: `${u.firstName} ${u.lastName}` }
    }));
    
    // Mix text: @u1 @u2 {Author} has asked for a review. {commentText}
    const paragraphContent = [];
    mentions.forEach(m => {
      paragraphContent.push(m);
      paragraphContent.push({ type: 'text', text: ' ' });
    });
    
    paragraphContent.push({ type: 'text', text: `${author?.firstName} has asked for a review.` });
    if (commentText) {
      paragraphContent.push({ type: 'text', text: ` ${commentText}` });
    }

    const tiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: paragraphContent
        }
      ]
    };

    const reviewers = reviewerIds.map(userId => ({ userId, status: 'PENDING' }));

    const comment = await FeedComment.create({
      workspaceId,
      projectId,
      feedLocalizationId: loc._id,
      authorId: requesterUserId,
      type: 'REVIEW_REQUEST',
      reviewers,
      content: tiptapDoc,
      mentions: reviewerIds,
      status: 'ACTIVE',
      isSystem: true
    });

    await FeedAuditLog.create({
      feedId,
      feedVersionId: activeVersionId,
      userId: requesterUserId,
      action: 'REQUESTED_REVIEW' as any,
      languageCode: language,
      notes: `Requested review from ${users.map(u => u.firstName).join(', ')}`
    });

    return comment;
  },

  async addReviewers(projectId: number, feedId: number, language: string, commentId: string, authorId: number, newReviewerIds: number[]) {
    const { loc } = await this.getActiveLocalization(projectId, feedId, language);

    const comment = await FeedComment.findOne({ _id: commentId, feedLocalizationId: loc._id, type: 'REVIEW_REQUEST' });
    if (!comment) throw new NotFoundError('Review request thread not found');
    if (comment.status !== 'ACTIVE') throw new BadRequestError('Cannot add reviewers to an inactive review request');

    const users = await prisma.user.findMany({ where: { id: { in: newReviewerIds } } });
    if (users.length !== newReviewerIds.length) throw new BadRequestError('One or more requested users do not exist');

    const existingIds = new Set((comment.reviewers || []).map(r => r.userId));
    const addedIds = [];
    
    for (const id of newReviewerIds) {
      if (!existingIds.has(id)) {
        if (comment.reviewers) comment.reviewers.push({ userId: id, status: 'PENDING' });
        addedIds.push(id);
      }
    }

    if (addedIds.length > 0) {
      await comment.save();
      const adder = await prisma.user.findUnique({ where: { id: authorId } });
      const addedUsers = await prisma.user.findMany({ where: { id: { in: addedIds } } });
      const addedNames = addedUsers.map(u => u.firstName).join(', ');
      
      await FeedComment.create({
        workspaceId: comment.workspaceId,
        projectId,
        feedLocalizationId: loc._id,
        authorId: -1,
        parentId: comment._id,
        type: 'GENERAL',
        isSystem: true,
        content: { 
          type: 'doc', 
          content: [{ 
            type: 'paragraph', 
            content: [
              { type: 'mention', attrs: { id: authorId.toString(), label: adder?.firstName || 'System' } }, 
              { type: 'text', text: ' added ' },
              ...addedUsers.flatMap((u, i) => [
                { type: 'mention', attrs: { id: u.id.toString(), label: u.firstName } },
                ...(i < addedUsers.length - 1 ? [{ type: 'text', text: ', ' }] : [])
              ]),
              { type: 'text', text: ' as reviewers.' }
            ] 
          }] 
        },
        mentions: addedIds,
        status: 'ACTIVE'
      });
    }

    return comment;
  },

  async approveReview(projectId: number, feedId: number, language: string, commentId: string, reviewerUserId: number) {
    const { loc, activeVersionId } = await this.getActiveLocalization(projectId, feedId, language);

    const comment = await FeedComment.findOne({ _id: commentId, feedLocalizationId: loc._id, type: 'REVIEW_REQUEST' });
    if (!comment) throw new NotFoundError('Review request thread not found');
    if (comment.status !== 'ACTIVE') throw new BadRequestError('This review thread is no longer active');

    const reviewerIndex = (comment.reviewers || []).findIndex(r => r.userId === reviewerUserId);
    if (reviewerIndex === -1) {
      throw new BadRequestError('You are not a requested reviewer on this thread');
    }

    if (comment.reviewers && comment.reviewers[reviewerIndex]) { comment.reviewers[reviewerIndex].status = 'APPROVED'; }
    await comment.save();

    const approver = await prisma.user.findUnique({ where: { id: reviewerUserId } });
    await FeedComment.create({
      workspaceId: comment.workspaceId,
      projectId,
      feedLocalizationId: loc._id,
      authorId: -1,
      parentId: comment._id,
      type: 'GENERAL',
      isSystem: true,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: reviewerUserId.toString(), label: approver?.firstName || 'System' } }, { type: 'text', text: ' approved the translation.' }] }] },
      mentions: [],
      status: 'ACTIVE'
    });

    await FeedAuditLog.create({
      feedId,
      feedVersionId: activeVersionId,
      userId: reviewerUserId,
      action: 'APPROVED_TRANSLATION' as any,
      languageCode: language,
      notes: 'Approved translation via review thread'
    });

    return comment;
  },

  async getReviewRequests(projectId: number, feedId: number, language: string) {
    const { loc } = await this.getActiveLocalization(projectId, feedId, language);
    // Return all ACTIVE review requests (should be max 1)
    return FeedComment.find({ feedLocalizationId: loc._id, type: 'REVIEW_REQUEST', status: 'ACTIVE' }).lean();
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
      let user = null;
      if (c.authorId && c.authorId !== -1) {
        user = await prisma.user.findUnique({ where: { id: c.authorId }, select: { id: true, firstName: true, lastName: true } });
      }
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
      let user = null;
      if (c.authorId && c.authorId !== -1) {
        user = await prisma.user.findUnique({ where: { id: c.authorId }, select: { id: true, firstName: true, lastName: true } });
      }
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


};
