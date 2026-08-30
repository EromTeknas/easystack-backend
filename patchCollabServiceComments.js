const fs = require('fs');
let content = fs.readFileSync('src/services/collaboration.service.ts', 'utf8');

const badAddComment = `  async addComment(projectId: number, feedId: number, language: string, userId: number, jsonPath: string, message: string) {
    const { loc, activeVersionId } = await this.getActiveLocalization(projectId, feedId, language);

    const comment = await FeedComment.create({
      feedLocalizationId: loc._id,
      userId,
      jsonPath,
      message
    });

    await FeedAuditLog.create({
      feedId,
      feedVersionId: activeVersionId,
      userId,
      action: 'ADDED_COMMENT' as any,
      languageCode: language,
      notes: \\\`Commented on \\\${jsonPath}: \\\${message.substring(0, 50)}\\\`
    });

    return comment;
  },

  async resolveComment(projectId: number, feedId: number, language: string, userId: number, commentId: string) {
    const { loc, activeVersionId } = await this.getActiveLocalization(projectId, feedId, language);

    const comment = await FeedComment.findOne({ _id: commentId, feedLocalizationId: loc._id });
    if (!comment) throw new NotFoundError('Comment not found');

    comment.isResolved = true;
    comment.resolvedByUserId = userId;
    comment.resolvedAt = new Date();
    await comment.save();

    await FeedAuditLog.create({
      feedId,
      feedVersionId: activeVersionId,
      userId,
      action: 'RESOLVED_COMMENT' as any,
      languageCode: language,
      notes: \\\`Resolved comment on \\\${comment.jsonPath}\\\`
    });

    return comment;
  },`;

const newCommentMethods = `  async createComment(workspaceId: number, projectId: number, feedId: number, language: string, authorId: number, payload: { content: any; mentions?: number[]; parentId?: string; jsonPath?: string }) {
    const { loc, activeVersionId } = await this.getActiveLocalization(projectId, feedId, language);

    if (payload.parentId) {
      const parent = await FeedComment.findById(payload.parentId);
      if (!parent || parent.feedLocalizationId.toString() !== loc._id.toString()) {
        throw new BadRequestError('Invalid parent comment');
      }
    }

    const comment = await FeedComment.create({
      workspaceId,
      projectId,
      feedLocalizationId: loc._id,
      authorId,
      parentId: payload.parentId || null,
      jsonPath: payload.jsonPath,
      content: payload.content,
      mentions: payload.mentions || [],
      status: 'ACTIVE'
    });

    // Mock BullMQ Job Trigger
    if (payload.mentions && payload.mentions.length > 0) {
      console.log(\`[BULLMQ MOCK] Queued COMMENT_MENTION job for comment \${comment._id} targeting users: \${payload.mentions.join(', ')}\`);
    }

    await FeedAuditLog.create({
      feedId,
      feedVersionId: activeVersionId,
      userId: authorId,
      action: 'ADDED_COMMENT' as any,
      languageCode: language,
      notes: \`Added a comment\`
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
      return {
        ...c,
        replyCount,
        author: user
      };
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
      return { ...c, author: user };
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
  },`;

content = content.replace(/async addComment.*return comment;\n  },/s, newCommentMethods);
fs.writeFileSync('src/services/collaboration.service.ts', content);
