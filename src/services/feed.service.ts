import { JsonValidationService, JsonValidationError } from "./json-validation.service";
import { prisma } from '../db';
import { FeedVersion } from '../models/feed-version.model';
import { FeedLocalization } from '../models/feed-localization.model';
import { FeedAuditLog } from '../models/feed-audit-log.model';
import { FeedComment } from '../models/feed-comment.model';
import { BadRequestError, NotFoundError } from '../errors';

function getDeepKeys(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [prefix].filter(Boolean);
  return Object.keys(obj).reduce((acc: string[], key: string) => {
    return acc.concat(getDeepKeys(obj[key], prefix ? `${prefix}.${key}` : key));
  }, []);
}

export const FeedService = {
  async updateDraftBaseContent(projectId: number, feedId: number, userId: number, jsonContent: any, notes?: string, selectedKeys?: string[]) {
    const devEnvState = await prisma.environmentState.findFirst({
      where: { feedId, feed: { projectId }, environment: { name: 'development' } }
    });
    if (!devEnvState) throw new NotFoundError('Feed not found or no active development draft');

    const feedVersion = await FeedVersion.findById(devEnvState.activeVersionId);
    if (!feedVersion) throw new NotFoundError('Draft version not found');

    // Run JSON validation
    JsonValidationService.validate(jsonContent, selectedKeys || feedVersion.selectedKeys);

    // Check if structure changed
    const oldKeys = getDeepKeys(feedVersion.baseContent).sort().join(',');
    const newKeys = getDeepKeys(jsonContent).sort().join(',');
    const structureChanged = oldKeys !== newKeys;

    feedVersion.baseContent = jsonContent;
    if (selectedKeys) {
      feedVersion.selectedKeys = selectedKeys;
    }
    await feedVersion.save();

    // Mirror the new base content into the base language's FeedLocalization document
    await FeedLocalization.updateOne(
      { feedVersionId: feedVersion._id, languageCode: feedVersion.baseLanguage },
      { $set: { localizedContent: jsonContent } }
    );

    // Mark all other translations as STALE so frontend shows a warning
    await FeedLocalization.updateMany(
      { 
        feedVersionId: feedVersion._id, 
        languageCode: { $ne: feedVersion.baseLanguage } 
      },
      { 
        $set: { status: 'STALE' } 
      }
    );

    // Get ALL localization IDs for this version (including the base language!)
    const allLocs = await FeedLocalization.find(
      { feedVersionId: feedVersion._id },
      { _id: 1 }
    ).lean();
    
    // Reset approvals because the base content changed!
    if (allLocs.length > 0) {
      const activeReviews = await FeedComment.find({ feedLocalizationId: { $in: allLocs.map(l => l._id) }, type: 'REVIEW_REQUEST', status: 'ACTIVE' });
      for (const review of activeReviews) {
        const hasApprovals = review.reviewers && review.reviewers.some((r: any) => r.status === 'APPROVED');
        if (hasApprovals) {
          await FeedComment.updateOne(
            { _id: review._id },
            { $set: { "reviewers.$[].status": "PENDING" } }
          );
          
          const author = await prisma.user.findUnique({ where: { id: userId } });
          await FeedComment.create({
            workspaceId: review.workspaceId,
            projectId,
            feedLocalizationId: review.feedLocalizationId,
            authorId: -1,
            parentId: review._id,
            type: 'GENERAL',
            isSystem: true,
            content: { 
              type: 'doc', 
              content: [
                { 
                  type: 'paragraph', 
                  content: [
                    { type: 'mention', attrs: { id: userId.toString(), label: author?.firstName || 'System' } },
                    { type: 'text', text: ' made changes to the base content. Approvals have been reset.' }
                  ] 
                }
              ] 
            },
            mentions: [userId],
            status: 'ACTIVE'
          });
        }
      }
    }

    if (structureChanged) {
      // Mark all COMPLETED translations (except base language) as STALE
      await FeedLocalization.updateMany(
        { 
          feedVersionId: feedVersion._id, 
          languageCode: { $ne: feedVersion.baseLanguage },
          status: 'COMPLETED' 
        },
        { $set: { status: 'STALE' } }
      );
    }

    await FeedAuditLog.create({
      feedId,
      feedVersionId: feedVersion._id,
      userId,
      action: 'UPDATED_BASE',
      notes: notes || 'Updated base content'
    });

    return { success: true };
  },


  async markLocalizationCompleted(projectId: number, feedId: number, userId: number, language: string) {
    const devEnvState = await prisma.environmentState.findFirst({
      where: { feedId, feed: { projectId }, environment: { name: 'development' } }
    });
    if (!devEnvState) throw new NotFoundError('Feed not found or no active development draft');

    const feedVersion = await FeedVersion.findById(devEnvState.activeVersionId).lean();
    if (!feedVersion) throw new NotFoundError('FeedVersion not found');

    const loc = await FeedLocalization.findOne({ feedVersionId: devEnvState.activeVersionId, languageCode: language });
    if (!loc) throw new NotFoundError('Localization not found');

    // Strongly enforce structure match before allowing it to be marked as completed
    JsonValidationService.validateStructureMatch(feedVersion.baseContent, loc.localizedContent);

    loc.status = 'COMPLETED';
    await loc.save();

    await FeedAuditLog.create({
      feedId,
      feedVersionId: devEnvState.activeVersionId,
      userId,
      action: 'UPDATED_TRANSLATION' as any,
      languageCode: language,
      notes: 'Marked STALE translation as COMPLETED without changes'
    });

    return loc;
  },

  async updateDraftLocalization(projectId: number, feedId: number, userId: number, language: string, localizedContent: any, notes?: string) {
    const devEnvState = await prisma.environmentState.findFirst({
      where: { feedId, feed: { projectId }, environment: { name: 'development' } }
    });
    if (!devEnvState) throw new NotFoundError('Feed not found or no active development draft');

    const feedVersion = await FeedVersion.findById(devEnvState.activeVersionId).lean();
    if (!feedVersion) throw new NotFoundError('FeedVersion not found');

    const loc = await FeedLocalization.findOne({ feedVersionId: devEnvState.activeVersionId, languageCode: language });
    if (!loc) throw new NotFoundError('Localization not found');

    // Strictly validate that the JSON structure matches the English base structure
    JsonValidationService.validateStructureMatch(feedVersion.baseContent, localizedContent);

    loc.localizedContent = localizedContent;
    loc.status = 'COMPLETED';
    await loc.save();

    // Reset approvals on any active review requests
    const activeReview = await FeedComment.findOne({ feedLocalizationId: loc._id, type: 'REVIEW_REQUEST', status: 'ACTIVE' });
    console.log("DEBUG loc activeReview:", activeReview ? activeReview._id : "None");
    if (activeReview) {
      const hasApprovals = activeReview.reviewers.some((r: any) => r.status === 'APPROVED');
      console.log("DEBUG loc hasApprovals:", hasApprovals);
      console.log("DEBUG loc reviewers before:", JSON.stringify(activeReview.reviewers));
      if (hasApprovals) {
        // Use raw MongoDB update to guarantee nested array update
        const updateRes = await FeedComment.updateOne(
          { _id: activeReview._id },
          { $set: { "reviewers.$[elem].status": "PENDING" } },
          { arrayFilters: [ { "elem.status": "APPROVED" } ] }
        );
        console.log("DEBUG loc updateRes:", updateRes);
        
        const author = await prisma.user.findUnique({ where: { id: userId } });
        
        // Add system comment
        await FeedComment.create({
          workspaceId: activeReview.workspaceId,
          projectId,
          feedLocalizationId: loc._id,
          authorId: -1,
          parentId: activeReview._id,
          type: 'GENERAL',
          isSystem: true,
          content: { 
            type: 'doc', 
            content: [
              { 
                type: 'paragraph', 
                content: [
                  { type: 'mention', attrs: { id: userId.toString(), label: author?.firstName || 'System' } },
                  { type: 'text', text: ' made changes to the translation. Approvals have been reset.' }
                ] 
              }
            ] 
          },
          mentions: [userId],
          status: 'ACTIVE'
        });
      }
    }

    await FeedAuditLog.create({
      feedId,
      feedVersionId: devEnvState.activeVersionId,
      userId,
      action: 'UPDATED_TRANSLATION',
      languageCode: language,
      notes: notes || 'Manually updated translation'
    });

    return { success: true };
  },

  async getAuditLogs(projectId: number, feedId: number) {
    const devEnvState = await prisma.environmentState.findFirst({
      where: { feedId, feed: { projectId }, environment: { name: 'development' } }
    });
    if (!devEnvState) throw new NotFoundError('Feed not found or no active development draft');

    const logs = await FeedAuditLog.find({ feedVersionId: devEnvState.activeVersionId }).sort({ createdAt: -1 }).lean();
    
    // Extract unique user IDs (exclude system ID -1)
    const userIds = Array.from(new Set(logs.map(log => log.userId).filter(id => id !== -1)));
    
    // Fetch user details from Prisma
    let usersMap: Record<number, any> = {};
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, resourceId: true, firstName: true, lastName: true }
      });
      usersMap = users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<number, any>);
    }

    // Map logs to include user details
    const enrichedLogs = logs.map(log => {
      let user = null;
      if (log.userId === -1) {
        user = { resourceId: 'system', firstName: 'System', lastName: '' };
      } else if (usersMap[log.userId]) {
        user = usersMap[log.userId];
      }

      return {
        ...log,
        user
      };
    });

    return enrichedLogs;
  },

  /**
   * List feeds for a specific environment within a project
   */
  async listFeeds(
    projectId: number, 
    environmentName: string, 
    options: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; status?: string } = {}
  ) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc', status } = options;

    const environment = await prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: environmentName } }
    });

    if (!environment) {
      throw new NotFoundError(`Environment ${environmentName} not found`);
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const supportedLanguages = (project?.supportedLanguages as string[]) || ['en'];

    // 1. Fetch all matching feeds from Prisma (since we may need to sort/filter by aggregateStatus in-memory)
    const whereClause: any = { projectId };
    if (search) {
      whereClause.name = { contains: search }; // basic substring search
    }

    const feeds = await prisma.feed.findMany({
      where: whereClause,
      include: {
        states: {
          where: { environmentId: environment.id }
        }
      }
    });

    // 2. Enrich all feeds with MongoDB data
    let enrichedFeeds = await Promise.all(feeds.map(async (feed) => {
      const activeState = feed.states[0];
      if (!activeState) return { ...feed, activeVersion: null };

      const activeVersion = await FeedVersion.findById(activeState.activeVersionId).lean();
      if (!activeVersion) return { ...feed, activeVersion: null };

      const localizations = await FeedLocalization.find({ feedVersionId: activeState.activeVersionId }).lean();
      const languages: { code: string, status: string }[] = localizations.map(l => ({
        code: l.languageCode,
        status: l.status
      }));

      if (!languages.find(l => l.code === feed.baseLanguage)) { languages.unshift({ code: feed.baseLanguage, status: 'COMPLETED' }); }

      for (const lang of supportedLanguages) {
        if (!languages.find(l => l.code === lang)) {
          languages.push({ code: lang, status: 'UNTRANSLATED' });
        }
      }

      const allStatuses = languages.map(l => l.status);
      let aggregateStatus = 'COMPLETED';
      if (allStatuses.includes('PROCESSING') || allStatuses.includes('PENDING')) {
        aggregateStatus = 'TRANSLATING';
      } else if (allStatuses.includes('FAILED')) {
        aggregateStatus = 'FAILED';
      } else if ((allStatuses as string[]).includes('UNTRANSLATED') || allStatuses.includes('STALE')) {
        aggregateStatus = 'PARTIALLY_COMPLETED';
      }

      return {
        ...feed,
        activeVersion: {
          id: activeVersion._id.toString(),
          versionNumber: activeVersion.versionNumber,
          notes: activeVersion.notes,
          keyCount: Object.keys(activeVersion.baseContent || {}).length,
          aggregateStatus,
          languages,
          selectedKeys: activeVersion.selectedKeys || []
        }
      };
    }));

    // 3. Filter by aggregateStatus if provided
    if (status) {
      enrichedFeeds = enrichedFeeds.filter(f => f.activeVersion?.aggregateStatus === status);
    }

    // 4. Sort in memory
    enrichedFeeds.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortBy === 'aggregateStatus') {
        valA = a.activeVersion?.aggregateStatus || '';
        valB = b.activeVersion?.aggregateStatus || '';
      } else if (sortBy === 'updatedAt') {
        valA = new Date(a.updatedAt).getTime();
        valB = new Date(b.updatedAt).getTime();
      } else {
        // default to createdAt
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // 5. Paginate
    const total = enrichedFeeds.length;
    const skip = (page - 1) * limit;
    const paginatedFeeds = enrichedFeeds.slice(skip, skip + limit);

    return {
      feeds: paginatedFeeds,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  async isFeedNameAvailable(projectId: number, name: string) {
    const count = await prisma.feed.count({ where: { projectId, name } });
    return count === 0;
  },

  async getFeedDetail(projectId: number, feedId: number) {
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      include: {
        states: { include: { environment: true } }
      }
    });

    if (!feed || feed.projectId !== projectId) {
      throw new Error("Feed not found");
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const supportedLanguages = (project?.supportedLanguages as string[]) || ['en'];

    const versions = await FeedVersion.find({ feedId: feed.id }).sort({ versionNumber: -1 }).lean();

    const history = await Promise.all(versions.map(async (v) => {
      const localizations = await FeedLocalization.find({ feedVersionId: v._id }).lean();
      
      const languages: { code: string, status: string }[] = localizations.map(l => ({ code: l.languageCode, status: l.status }));
      if (!languages.find(l => l.code === feed.baseLanguage)) { languages.unshift({ code: feed.baseLanguage, status: "COMPLETED" }); }

      for (const lang of supportedLanguages) {
        if (!languages.find(l => l.code === lang)) {
          languages.push({ code: lang, status: 'UNTRANSLATED' });
        }
      }

      const allStatuses = languages.map(l => l.status);
      let aggregateStatus = "COMPLETED";
      if (allStatuses.includes("PROCESSING") || allStatuses.includes("PENDING")) {
        aggregateStatus = "TRANSLATING";
      } else if (allStatuses.includes("FAILED")) {
        aggregateStatus = "FAILED";
      } else if (allStatuses.includes("UNTRANSLATED") || allStatuses.includes("STALE")) {
        aggregateStatus = "PARTIALLY_COMPLETED";
      }

      const activeInEnvironments = feed.states
        .filter(s => s.activeVersionId === v._id.toString())
        .map(s => s.environment.name);

      return {
        id: v._id.toString(),
        versionNumber: v.versionNumber,
        notes: v.notes,
        keyCount: Object.keys(v.baseContent || {}).length,
        aggregateStatus,
        languages,
        selectedKeys: v.selectedKeys || [],
        createdAt: v.createdAt,
        activeInEnvironments
      };
    }));

    return {
      id: feed.id,
      name: feed.name,
      baseLanguage: feed.baseLanguage,
      createdAt: feed.createdAt,
      updatedAt: feed.updatedAt,
      history
    };
  },

  async createFeed(projectId: number, userId: number, data: { name: string, baseLanguage?: string, jsonContent: any, selectedKeys?: string[] }) {
    const { name, baseLanguage = 'en', jsonContent, selectedKeys } = data;

    // 1. Validate JSON and Selected Keys
    try {
      JsonValidationService.validate(jsonContent, selectedKeys);
    } catch (error: any) {
      if (error instanceof JsonValidationError) {
        throw new BadRequestError(`JSON Validation Failed: ${error.message}`);
      }
      throw error;
    }

    let feed;
    try {
      // Create Feed in MySQL
      feed = await prisma.feed.create({
        data: {
          projectId,
          name,
          baseLanguage,
        }
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestError('A feed with this name already exists in this project');
      }
      throw error;
    }

    // Create v1 in MongoDB
    const feedVersion = await FeedVersion.create({
      feedId: feed.id,
      versionNumber: 1,
      notes: 'Initial upload',
      baseLanguage,
      baseContent: jsonContent,
      ...(selectedKeys ? { selectedKeys } : {}),
      createdBy: userId,
    });

    // Create Base Localization in MongoDB
    await FeedLocalization.create({
      feedVersionId: feedVersion._id,
      languageCode: baseLanguage,
      status: 'COMPLETED',
      localizedContent: jsonContent,
    });

    await FeedAuditLog.create({
      feedId: feed.id,
      feedVersionId: feedVersion._id,
      userId,
      action: 'CREATED_VERSION',
      notes: 'Initial upload'
    });

    // Link v1 to 'development' environment in MySQL
    const devEnv = await prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: 'development' } }
    });

    if (devEnv) {
      await prisma.environmentState.create({
        data: {
          environmentId: devEnv.id,
          feedId: feed.id,
          activeVersionId: feedVersion._id.toString(),
        }
      });
    }

    // TRIGGER TRANSLATIONS for non-base languages supported by the project
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.supportedLanguages && Array.isArray(project.supportedLanguages)) {
      const { translationQueue } = require('./feed/infrastructure/queue/translation.queue');
      const supportedLanguages = project.supportedLanguages as string[];
      for (const lang of supportedLanguages) {
        if (lang === baseLanguage) continue;

        // Create PENDING localization in MongoDB
        const loc = await FeedLocalization.create({
          feedVersionId: feedVersion._id,
          languageCode: lang,
          status: 'PENDING',
          localizedContent: {},
        });

        // Push to BullMQ
        await translationQueue.add('translate', {
          localizationId: (loc as any)._id.toString(),
          feedVersionId: (feedVersion as any)._id.toString(),
          targetLang: lang,
          selectedKeys,
          userId,
        });
      }
    }

    return {
      feedId: feed.id,
      versionId: feedVersion._id,
      versionNumber: 1
    };
  },

  /**
   * Get statuses of all localizations for a feed's development environment
   */
  async getLocalizationStatuses(feedId: number) {
    const devEnvState = await prisma.environmentState.findFirst({
      where: { feedId, environment: { name: 'development' } }
    });

    if (!devEnvState) {
      throw new NotFoundError('Feed not active in development environment');
    }

    const localizations = await FeedLocalization.find({ feedVersionId: devEnvState.activeVersionId }).lean();
    
    // Determine aggregate status
    const allStatuses = localizations.map(l => l.status);
    let aggregateStatus = 'COMPLETED';
    if (allStatuses.includes('FAILED')) aggregateStatus = 'FAILED';
    else if (allStatuses.includes('PROCESSING') || allStatuses.includes('PENDING')) {
      aggregateStatus = 'TRANSLATING';
    }
    else if ((allStatuses as string[]).includes('UNTRANSLATED') || allStatuses.includes('STALE')) {
      aggregateStatus = 'PARTIALLY_COMPLETED';
    }

    return {
      aggregateStatus,
      localizations: localizations.map(l => ({
        language: l.languageCode,
        status: l.status,
        attempts: l.attempts || 0,
        lastError: l.lastError ? 'Translation failed due to an internal error. Please try again.' : null
      }))
    };
  },

  /**
   * Get content for a specific localization
   */
  async getLocalizationContent(feedId: number, language: string) {
    const devEnvState = await prisma.environmentState.findFirst({
      where: { feedId, environment: { name: 'development' } }
    });

    if (!devEnvState) {
      throw new NotFoundError('Feed not active in development environment');
    }

    const localization = await FeedLocalization.findOne({ 
      feedVersionId: devEnvState.activeVersionId, 
      languageCode: language 
    }).lean();

    if (!localization) {
      throw new NotFoundError('Localization not found');
    }
    
    const version = await FeedVersion.findById(devEnvState.activeVersionId).lean();

    let canBeMarkedCompleted = false;
    let staleReason = null;

    if (localization.status === 'STALE') {
      try {
        if (version) JsonValidationService.validateStructureMatch(version.baseContent, localization.localizedContent);
        canBeMarkedCompleted = true;
        staleReason = "The base English text was updated, so this translation was marked as STALE. If this translation is still accurate, you can mark it as correct.";
      } catch (err: any) {
        canBeMarkedCompleted = false;
        staleReason = "The structure of the base English content was changed. " + err.message;
      }
    }

    return { 
      content: localization.localizedContent,
      selectedKeys: version?.selectedKeys || [],
      canBeMarkedCompleted,
      staleReason
    };
  },

  /**
   * Retry a failed localization manually
   */
  async retryLocalization(feedId: number, language: string, userId: number, selectedKeys?: string[]) {
    const devEnvState = await prisma.environmentState.findFirst({
      where: { feedId, environment: { name: 'development' } },
      include: { feed: true }
    });

    if (!devEnvState) {
      throw new NotFoundError('Feed not active in development environment');
    }

    let localization = await FeedLocalization.findOne({ 
      feedVersionId: devEnvState.activeVersionId, 
      languageCode: language 
    });

    if (!localization) {
      const project = await prisma.project.findUnique({ where: { id: devEnvState.feed.projectId } });
      const supportedLanguages = (project?.supportedLanguages as string[]) || ['en'];
      
      if (!supportedLanguages.includes(language)) {
        throw new BadRequestError('Language not supported by project');
      }

      localization = await FeedLocalization.create({
        feedVersionId: devEnvState.activeVersionId,
        languageCode: language,
        status: 'PENDING',
        localizedContent: {}
      });
    } else {
      localization.status = 'PENDING';
      localization.set('lastError', undefined);
      await localization.save();
    }

    const { translationQueue } = require('./feed/infrastructure/queue/translation.queue');
    const version = await FeedVersion.findById(devEnvState.activeVersionId).lean();
    const finalSelectedKeys = selectedKeys || (version ? version.selectedKeys : undefined);
    await translationQueue.add('translate', {
      localizationId: localization._id.toString(),
      feedVersionId: devEnvState.activeVersionId,
      targetLang: language,
      selectedKeys: finalSelectedKeys,
      userId,
    });

    return true;
  }
};
