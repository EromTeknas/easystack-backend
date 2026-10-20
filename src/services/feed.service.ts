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
  async updateDraftBaseContent(
    projectId: number, 
    feedId: number, 
    userId: number, 
    jsonContent: any, 
    environmentId?: number | undefined, 
    notes?: string | undefined, 
    selectedKeys?: string[] | undefined,
    environmentName?: string | undefined
  ) {
    let targetEnv = null;
    if (environmentId) {
      targetEnv = await prisma.environment.findFirst({ where: { id: Number(environmentId), projectId } });
    } else {
      targetEnv = await prisma.environment.findUnique({
        where: { projectId_name: { projectId, name: environmentName || 'development' } }
      });
    }
    if (!targetEnv) throw new NotFoundError('Environment not found');
    if (!targetEnv.isEditable) throw new BadRequestError('Cannot edit feeds in a read-only environment.');

    const devEnvState = await prisma.environmentState.findUnique({
      where: { environmentId_feedId: { environmentId: targetEnv.id, feedId } }
    });
    if (!devEnvState) throw new NotFoundError('Feed not found or no active draft in this environment');

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


  async markLocalizationCompleted(projectId: number, feedId: number, userId: number, language: string, environmentName: string = 'development') {
    const targetEnv = await prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: environmentName } }
    }) || await prisma.environment.findFirst({
      where: { projectId, name: 'development' }
    });
    if (!targetEnv) throw new NotFoundError('Environment not found');
    if (!targetEnv.isEditable) {
      throw new BadRequestError(`Cannot modify translations in read-only environment '${targetEnv.name}'.`);
    }

    const envState = await prisma.environmentState.findFirst({
      where: { feedId, environmentId: targetEnv.id }
    });
    if (!envState) throw new NotFoundError(`Feed not found or no active version in environment '${targetEnv.name}'`);

    const feedVersion = await FeedVersion.findById(envState.activeVersionId).lean();
    if (!feedVersion) throw new NotFoundError('FeedVersion not found');
    if (feedVersion.isLocked) throw new BadRequestError('Cannot modify a locked release snapshot. A new draft must be created in development.');

    const loc = await FeedLocalization.findOne({ feedVersionId: envState.activeVersionId, languageCode: language });
    if (!loc) throw new NotFoundError('Localization not found');

    // Strongly enforce structure match before allowing it to be marked as completed
    JsonValidationService.validateStructureMatch(feedVersion.baseContent, loc.localizedContent);

    loc.status = 'COMPLETED';
    await loc.save();

    await FeedAuditLog.create({
      feedId,
      feedVersionId: envState.activeVersionId,
      userId,
      action: 'UPDATED_TRANSLATION' as any,
      languageCode: language,
      notes: 'Marked STALE translation as COMPLETED without changes'
    });

    return loc;
  },

  async updateDraftLocalization(projectId: number, feedId: number, userId: number, language: string, localizedContent: any, notes?: string, environmentName: string = 'development') {
    const targetEnv = await prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: environmentName } }
    }) || await prisma.environment.findFirst({
      where: { projectId, name: 'development' }
    });
    if (!targetEnv) throw new NotFoundError('Environment not found');
    if (!targetEnv.isEditable) {
      throw new BadRequestError(`Cannot modify translations in read-only environment '${targetEnv.name}'.`);
    }

    const envState = await prisma.environmentState.findFirst({
      where: { feedId, environmentId: targetEnv.id }
    });
    if (!envState) throw new NotFoundError(`Feed not found or no active version in environment '${targetEnv.name}'`);

    const feedVersion = await FeedVersion.findById(envState.activeVersionId).lean();
    if (!feedVersion) throw new NotFoundError('FeedVersion not found');
    if (feedVersion.isLocked) throw new BadRequestError('Cannot modify a locked release snapshot. A new draft must be created in development.');

    const loc = await FeedLocalization.findOne({ feedVersionId: envState.activeVersionId, languageCode: language });
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
      feedVersionId: envState.activeVersionId,
      userId,
      action: 'UPDATED_TRANSLATION',
      languageCode: language,
      notes: notes || 'Manually updated translation'
    });

    return { success: true };
  },

  async getAuditLogs(projectId: number, feedId: number, environmentName: string = 'development') {
    const targetEnv = await prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: environmentName } }
    }) || await prisma.environment.findFirst({
      where: { projectId, name: 'development' }
    });
    if (!targetEnv) throw new NotFoundError('Environment not found');

    const envState = await prisma.environmentState.findFirst({
      where: { feedId, environmentId: targetEnv.id }
    });
    if (!envState) return [];

    const logs = await FeedAuditLog.find({ feedVersionId: envState.activeVersionId }).sort({ createdAt: -1 }).lean();
    
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
    const whereClause: any = { projectId, states: { some: { environmentId: environment.id } } };
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

  async getFeedDetail(projectId: number, feedId: number, environmentName: string = 'development') {
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      include: {
        states: { include: { environment: true } }
      }
    });

    if (!feed || feed.projectId !== projectId) {
      throw new Error("Feed not found");
    }

    const targetEnv = await prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: environmentName } }
    }) || await prisma.environment.findFirst({
      where: { projectId, name: 'development' }
    });

    const activeState = targetEnv 
      ? feed.states.find(s => s.environmentId === targetEnv.id)
      : null;

    let activeVersion = null;
    if (activeState?.activeVersionId) {
      activeVersion = await FeedVersion.findById(activeState.activeVersionId).lean();
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const supportedLanguages = (project?.supportedLanguages as string[]) || ['en'];

    const versions = await FeedVersion.find({ feedId: feed.id }).sort({ versionNumber: -1 }).lean();

    const userIds = Array.from(new Set(versions.map(v => v.createdBy).filter(Boolean)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true }
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const history = await Promise.all(versions.map(async (v) => {
      const localizations = await FeedLocalization.find({ feedVersionId: v._id }).lean();
      
      const languages: { code: string, status: string }[] = localizations.map(l => ({ code: l.languageCode, status: l.status }));
      if (!languages.find(l => l.code === feed.baseLanguage)) { languages.unshift({ code: feed.baseLanguage, status: "COMPLETED" }); }

      // Determine the target languages configured for this version snapshot:
      // If version is locked:
      //   - Use its snapshotted supportedLanguages if available
      //   - Otherwise (legacy locked versions), use the languages that actually exist in this version snapshot
      // If version is not locked (active working draft):
      //   - Use project.supportedLanguages (so newly added project languages show as UNTRANSLATED in draft)
      let targetLanguages: string[];
      if (v.isLocked) {
        if (v.supportedLanguages && Array.isArray(v.supportedLanguages) && v.supportedLanguages.length > 0) {
          targetLanguages = v.supportedLanguages;
        } else {
          targetLanguages = Array.from(new Set([feed.baseLanguage, ...languages.map(l => l.code)]));
        }
      } else {
        targetLanguages = supportedLanguages;
      }

      for (const lang of targetLanguages) {
        if (!languages.find(l => l.code === lang)) {
          languages.push({ code: lang, status: 'UNTRANSLATED' });
        }
      }

      // Filter languages to only targetLanguages for this version
      const versionLanguages = languages.filter(l => targetLanguages.includes(l.code));

      const allStatuses = versionLanguages.map(l => l.status);
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
        languages: versionLanguages,
        supportedLanguages: targetLanguages,
        selectedKeys: v.selectedKeys || [],
        isLocked: v.isLocked ?? false,
        createdBy: userMap.get(v.createdBy) || null,
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
      currentEnvironment: targetEnv ? {
        id: targetEnv.id,
        name: targetEnv.name,
        isEditable: targetEnv.isEditable,
        requiresApproval: targetEnv.requiresApproval
      } : null,
      activeVersion: activeVersion ? {
        id: activeVersion._id.toString(),
        versionNumber: activeVersion.versionNumber,
        isLocked: activeVersion.isLocked,
        notes: activeVersion.notes,
        selectedKeys: activeVersion.selectedKeys || [],
        keyCount: Object.keys(activeVersion.baseContent || {}).length,
        createdAt: activeVersion.createdAt,
      } : null,
      history
    };
  },

  async getFeedVersionDetail(projectId: number, feedId: number, versionId: string) {
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      include: {
        states: { include: { environment: true } }
      }
    });

    if (!feed || feed.projectId !== projectId) {
      throw new Error("Feed not found");
    }

    const version = await FeedVersion.findById(versionId).lean();
    if (!version || version.feedId !== feed.id) {
      throw new Error("Version not found");
    }

    const localizations = await FeedLocalization.find({ feedVersionId: version._id }).lean();

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const currentProjectLangs = (project?.supportedLanguages as string[]) || ['en'];

    let targetLanguages: string[];
    if (version.isLocked) {
      if (version.supportedLanguages && Array.isArray(version.supportedLanguages) && version.supportedLanguages.length > 0) {
        targetLanguages = version.supportedLanguages;
      } else {
        targetLanguages = Array.from(new Set([version.baseLanguage, ...localizations.map(l => l.languageCode)]));
      }
    } else {
      targetLanguages = currentProjectLangs;
    }

    const creator = version.createdBy
      ? await prisma.user.findUnique({
          where: { id: version.createdBy },
          select: { id: true, firstName: true, lastName: true, email: true }
        })
      : null;

    const activeInEnvironments = feed.states
      .filter(s => s.activeVersionId === version._id.toString())
      .map(s => s.environment.name);

    return {
      id: version._id.toString(),
      feedId: feed.id,
      versionNumber: version.versionNumber,
      notes: version.notes,
      baseLanguage: version.baseLanguage,
      baseContent: version.baseContent || {},
      selectedKeys: version.selectedKeys || [],
      keyCount: Object.keys(version.baseContent || {}).length,
      isLocked: version.isLocked ?? false,
      supportedLanguages: targetLanguages,
      createdAt: version.createdAt,
      createdBy: creator,
      activeInEnvironments,
      localizations: localizations.map(l => ({
        id: l._id.toString(),
        languageCode: l.languageCode,
        status: l.status,
        localizedContent: l.localizedContent || {},
        updatedAt: l.updatedAt
      }))
    };
  },

  async createFeed(
    projectId: number, 
    userId: number, 
    data: { 
      name: string, 
      environmentId?: number | undefined, 
      environmentName?: string | undefined,
      baseLanguage?: string | undefined, 
      jsonContent: any, 
      selectedKeys?: string[] | undefined 
    }
  ) {
    const { name, environmentId, environmentName, baseLanguage = 'en', jsonContent, selectedKeys } = data;

    let targetEnv = null;
    if (environmentId) {
      targetEnv = await prisma.environment.findFirst({ where: { id: Number(environmentId), projectId } });
    } else {
      targetEnv = await prisma.environment.findUnique({
        where: { projectId_name: { projectId, name: environmentName || 'development' } }
      });
    }

    if (!targetEnv) throw new NotFoundError('Environment not found');
    if (!targetEnv.isEditable) {
      throw new BadRequestError(`Cannot create feeds directly in read-only environment '${targetEnv.name}'. Feeds can only be created in editable environments (like development) and promoted via Release.`);
    }

    // Validate Quota
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true, supportedLanguages: true }
    });
    if (!project) throw new NotFoundError('Project not found');

    const { BillingService } = require('./billing/services/billing.service');
    await BillingService.authorize(project.workspaceId, {
      quotas: [{ 
        key: 'feeds_per_project', 
        amount: 1, 
        consume: true, 
        scope: 'PROJECT', 
        scopeId: projectId.toString() 
      }]
    });

    // 1. Validate JSON and Selected Keys
    try {
      JsonValidationService.validate(jsonContent, selectedKeys);
    } catch (error: any) {
      // Release quota if validation fails
      await BillingService.releaseQuota(project.workspaceId, 'feeds_per_project', 1, { scope: 'PROJECT', scopeId: projectId.toString() });
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
      await BillingService.releaseQuota(project.workspaceId, 'feeds_per_project', 1, { scope: 'PROJECT', scopeId: projectId.toString() });
      if (error.code === 'P2002') {
        throw new BadRequestError('A feed with this name already exists in this project');
      }
      throw error;
    }

    // Create v0 in MongoDB
    const feedVersion = await FeedVersion.create({
      feedId: feed.id,
      versionNumber: 0,
      notes: 'Initial upload',
      baseLanguage,
      baseContent: jsonContent,
      supportedLanguages: (project.supportedLanguages as string[]) || [baseLanguage],
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

    // Link v1 to target environment in MySQL
    if (targetEnv) {
      await prisma.environmentState.create({
        data: {
          environmentId: targetEnv.id,
          feedId: feed.id,
          activeVersionId: feedVersion._id.toString(),
        }
      });
    }

    // TRIGGER TRANSLATIONS for non-base languages supported by the project
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
      versionNumber: 0
    };
  },

  /**
   * Get statuses of all localizations for a feed in a specific environment
   */
  async getLocalizationStatuses(projectId: number, feedId: number, environmentName: string = 'development') {
    const targetEnv = await prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: environmentName } }
    }) || await prisma.environment.findFirst({
      where: { projectId, name: 'development' }
    });

    if (!targetEnv) {
      throw new NotFoundError(`Environment '${environmentName}' not found`);
    }

    const envState = await prisma.environmentState.findFirst({
      where: { feedId, environmentId: targetEnv.id }
    });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const supportedLanguages = (project?.supportedLanguages as string[]) || ['en'];
    const feed = await prisma.feed.findUnique({ where: { id: feedId } });
    const baseLanguage = feed?.baseLanguage || 'en';

    if (!envState) {
      return {
        aggregateStatus: 'PARTIALLY_COMPLETED',
        isEditable: targetEnv.isEditable,
        localizations: supportedLanguages.map(lang => ({
          language: lang,
          status: lang === baseLanguage ? 'COMPLETED' : 'UNTRANSLATED',
          attempts: 0,
          lastError: null
        }))
      };
    }

    const localizations = await FeedLocalization.find({ feedVersionId: envState.activeVersionId }).lean();
    const localizationsMap = new Map<string, any>();
    localizations.forEach(l => {
      localizationsMap.set(l.languageCode, l);
    });

    const activeVersion = await FeedVersion.findById(envState.activeVersionId).lean();

    // Determine expected languages for this environment:
    // If viewing a locked snapshot, expected languages are those configured when locked.
    // If viewing an editable environment, expected languages are current project.supportedLanguages.
    let expectedLanguages = supportedLanguages;
    if (activeVersion?.isLocked) {
      if (activeVersion.supportedLanguages && Array.isArray(activeVersion.supportedLanguages) && activeVersion.supportedLanguages.length > 0) {
        expectedLanguages = activeVersion.supportedLanguages;
      } else {
        expectedLanguages = Array.from(new Set([baseLanguage, ...localizations.map(l => l.languageCode)]));
      }
    }

    const mappedLocalizations = expectedLanguages.map(lang => {
      if (lang === baseLanguage) {
        return {
          language: lang,
          status: 'COMPLETED',
          attempts: 0,
          lastError: null
        };
      }
      const existing = localizationsMap.get(lang);
      if (existing) {
        return {
          language: existing.languageCode,
          status: existing.status,
          attempts: existing.attempts || 0,
          lastError: existing.lastError ? 'Translation failed due to an internal error. Please try again.' : null
        };
      }
      return {
        language: lang,
        status: 'UNTRANSLATED',
        attempts: 0,
        lastError: null
      };
    });

    // Determine aggregate status
    const allStatuses = mappedLocalizations.map(l => l.status);
    let aggregateStatus = 'COMPLETED';
    if (allStatuses.includes('FAILED')) aggregateStatus = 'FAILED';
    else if (allStatuses.includes('PROCESSING') || allStatuses.includes('PENDING')) {
      aggregateStatus = 'TRANSLATING';
    } else if (allStatuses.includes('UNTRANSLATED') || allStatuses.includes('STALE')) {
      aggregateStatus = 'PARTIALLY_COMPLETED';
    }

    return {
      aggregateStatus,
      isEditable: targetEnv.isEditable,
      localizations: mappedLocalizations
    };
  },

  /**
   * Get content for a specific localization in a specific environment
   */
  async getLocalizationContent(projectId: number, feedId: number, language: string, environmentName: string = 'development') {
    const targetEnv = await prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: environmentName } }
    }) || await prisma.environment.findFirst({
      where: { projectId, name: 'development' }
    });

    if (!targetEnv) {
      throw new NotFoundError(`Environment '${environmentName}' not found`);
    }

    const envState = await prisma.environmentState.findFirst({
      where: { feedId, environmentId: targetEnv.id }
    });

    if (!envState) {
      throw new NotFoundError(`Feed not active in environment '${targetEnv.name}'`);
    }

    const version = await FeedVersion.findById(envState.activeVersionId).lean();
    if (!version) {
      throw new NotFoundError('FeedVersion not found');
    }

    // If requesting base language, return baseContent
    if (version.baseLanguage === language) {
      return {
        content: version.baseContent,
        selectedKeys: version.selectedKeys || [],
        canBeMarkedCompleted: false,
        staleReason: null,
        isEditable: targetEnv.isEditable
      };
    }

    const localization = await FeedLocalization.findOne({ 
      feedVersionId: envState.activeVersionId, 
      languageCode: language 
    }).lean();

    if (!localization) {
      throw new NotFoundError(`Localization for language '${language}' not found in environment '${targetEnv.name}'`);
    }

    let canBeMarkedCompleted = false;
    let staleReason = null;

    if (localization.status === 'STALE') {
      try {
        JsonValidationService.validateStructureMatch(version.baseContent, localization.localizedContent);
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
      staleReason,
      isEditable: targetEnv.isEditable
    };
  },

  /**
   * Retry a failed localization manually (only allowed in editable environments)
   */
  async retryLocalization(
    projectId: number, 
    feedId: number, 
    language: string, 
    userId: number, 
    selectedKeys?: string[], 
    environmentName: string = 'development'
  ) {
    const targetEnv = await prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: environmentName } }
    }) || await prisma.environment.findFirst({
      where: { projectId, name: 'development' }
    });

    if (!targetEnv) throw new NotFoundError('Environment not found');
    if (!targetEnv.isEditable) {
      throw new BadRequestError(`Cannot generate translations directly in read-only environment '${targetEnv.name}'. Translations must be generated in an editable environment (such as development) and promoted via Release.`);
    }

    const envState = await prisma.environmentState.findFirst({
      where: { feedId, environmentId: targetEnv.id },
      include: { feed: true }
    });

    if (!envState) {
      throw new NotFoundError(`Feed not active in environment '${targetEnv.name}'`);
    }

    let localization = await FeedLocalization.findOne({ 
      feedVersionId: envState.activeVersionId, 
      languageCode: language 
    });

    if (!localization) {
      const project = await prisma.project.findUnique({ where: { id: envState.feed.projectId } });
      const supportedLanguages = (project?.supportedLanguages as string[]) || ['en'];
      
      if (!supportedLanguages.includes(language)) {
        throw new BadRequestError('Language not supported by project');
      }

      localization = await FeedLocalization.create({
        feedVersionId: envState.activeVersionId,
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
    const version = await FeedVersion.findById(envState.activeVersionId).lean();
    const finalSelectedKeys = selectedKeys || (version ? version.selectedKeys : undefined);
    await translationQueue.add('translate', {
      localizationId: localization._id.toString(),
      feedVersionId: envState.activeVersionId,
      targetLang: language,
      selectedKeys: finalSelectedKeys,
      userId,
    });

    return true;
  },

  /**
   * Locks a FeedVersion and creates a new Draft (version N+1) for the Development environment.
   * Used when a feed is bundled into a Release.
   */
  async lockAndCloneForDevelopment(projectId: number, feedId: number, currentVersionId: string, userId: number) {
    const currentVersion = await FeedVersion.findById(currentVersionId);
    if (!currentVersion) throw new NotFoundError('FeedVersion not found');

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const projectLanguages = (project?.supportedLanguages as string[]) || [currentVersion.baseLanguage];

    if (!currentVersion.isLocked) {
      currentVersion.isLocked = true;
      currentVersion.supportedLanguages = (currentVersion.supportedLanguages && currentVersion.supportedLanguages.length > 0)
        ? currentVersion.supportedLanguages
        : projectLanguages;
      await currentVersion.save();
    }

    const nextVersionNumber = currentVersion.versionNumber + 1;

    const newVersionData: any = {
      feedId,
      versionNumber: nextVersionNumber,
      notes: `Branched from v${currentVersion.versionNumber} after release snapshot`,
      baseLanguage: currentVersion.baseLanguage,
      baseContent: currentVersion.baseContent,
      supportedLanguages: projectLanguages,
      createdBy: userId,
      isLocked: false
    };
    if (currentVersion.selectedKeys) {
      newVersionData.selectedKeys = currentVersion.selectedKeys;
    }
    const newVersion = await FeedVersion.create(newVersionData);

    const localizations = await FeedLocalization.find({ feedVersionId: currentVersionId }).lean();
    for (const loc of localizations) {
      await FeedLocalization.create({
        feedVersionId: newVersion._id,
        languageCode: loc.languageCode,
        status: loc.status,
        localizedContent: loc.localizedContent,
      });
    }

    await FeedAuditLog.create({
      feedId,
      feedVersionId: newVersion._id,
      userId,
      action: 'CREATED_VERSION',
      notes: `Auto-branched version ${nextVersionNumber} after locking v${currentVersion.versionNumber}`
    });

    const devEnv = await prisma.environment.findUnique({
      where: { projectId_name: { projectId, name: 'development' } }
    });

    if (devEnv) {
      await prisma.environmentState.upsert({
        where: { environmentId_feedId: { environmentId: devEnv.id, feedId } },
        update: { activeVersionId: newVersion._id.toString() },
        create: {
          environmentId: devEnv.id,
          feedId,
          activeVersionId: newVersion._id.toString(),
        }
      });
    }

    return newVersion._id.toString();
  },

};
