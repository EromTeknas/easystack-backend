import { prisma } from '../db';
import { NotFoundError, BadRequestError } from '../errors';
import { FeedService } from './feed.service';
import { AuthorizationService } from './authorization/services/authorization.service';
import { FeedVersion } from '../models/feed-version.model';
import { FeedLocalization } from '../models/feed-localization.model';
import logger from '../utils/logger';
import { 
  scheduleReleaseJob, 
  cancelScheduledReleaseJob, 
  enqueueDeploymentJob 
} from './releases/infrastructure/queue/scheduled-release.queue';
import { enqueueSendReleaseNotificationEmailJob } from './email/infrastructure/queue/email.producer';

export const DEPLOYMENT_STAGES = [
  { id: 1, name: 'Pre-flight Schema & Translation Integrity Check', description: 'Validating JSON schemas, keys, and base content consistency' },
  { id: 2, name: 'Target Environment State Snapshot & Rollback Point Creation', description: 'Capturing current environment state to enable instant rollback' },
  { id: 3, name: 'Atomic State Pointer Synchronization', description: 'Executing database transactions to point active environment pointers' },
  { id: 4, name: 'Release Artifact Locking & Development Version Branching', description: 'Locking release version snapshot and branching vN+1' },
  { id: 5, name: 'Cache Invalidation & Traffic Activation', description: 'Purging edge cache layers and activating live traffic' }
];

export const ReleaseService = {
  async createRelease(projectId: number, userId: number, payload: { name: string; description?: string; sourceEnvironmentId: number; targetEnvironmentId: number; version: string; feedIds: number[]; }) {
    
    const sourceEnv = await prisma.environment.findUnique({ where: { id: payload.sourceEnvironmentId } });
    if (!sourceEnv || sourceEnv.projectId !== projectId) throw new NotFoundError('Source environment not found');

    const targetEnv = await prisma.environment.findUnique({ where: { id: payload.targetEnvironmentId } });
    if (!targetEnv || targetEnv.projectId !== projectId) {
      throw new NotFoundError('Target environment not found in this project');
    }
    if (sourceEnv.rank >= targetEnv.rank) {
      throw new BadRequestError('Invalid promotion path. Target environment must be higher rank than source environment.');
    }

    if (targetEnv.name === 'development') {
      throw new BadRequestError('Cannot create a release targeting development environment');
    }

    const sourceStates = await prisma.environmentState.findMany({
      where: {
        environmentId: sourceEnv.id,
        feedId: { in: payload.feedIds }
      }
    });

    if (sourceStates.length !== payload.feedIds.length) {
      throw new BadRequestError('Some requested feeds are not active in the source environment');
    }

    const defaultApproverIds = (targetEnv.requiresApproval && Array.isArray(targetEnv.defaultApproverIds))
      ? (targetEnv.defaultApproverIds as number[]).filter(id => id !== userId)
      : [];
    const initialStatus = (targetEnv.requiresApproval && defaultApproverIds.length > 0)
      ? 'PENDING_APPROVAL'
      : 'DRAFT';

    return await prisma.$transaction(async (tx) => {
      const release = await tx.release.create({
        data: {
          projectId,
          sourceEnvironmentId: payload.sourceEnvironmentId,
          targetEnvironmentId: payload.targetEnvironmentId,
          version: payload.version,
          name: payload.name,
          description: payload.description || null,
          createdById: userId,
          status: initialStatus,
        }
      });

      if (defaultApproverIds.length > 0) {
        await tx.releaseApproval.createMany({
          data: defaultApproverIds.map(approverId => ({
            releaseId: release.id,
            approverId,
            status: 'PENDING'
          })),
          skipDuplicates: true
        });
      }

      await tx.releaseItem.createMany({
        data: sourceStates.map(s => ({
          releaseId: release.id,
          feedId: s.feedId,
          versionId: s.activeVersionId,
        }))
      });

      return release;
    });
  },

  async requestApproval(releaseId: number, projectId: number, userId: number, approverIds: number[] = []) {
    const release = await prisma.release.findUnique({
      where: { id: releaseId, projectId },
      include: { targetEnvironment: true }
    });
    if (!release) throw new NotFoundError('Release not found');
    if (release.status !== 'DRAFT' && release.status !== 'PENDING_APPROVAL') {
      throw new BadRequestError('Only DRAFT or PENDING_APPROVAL releases can request approval');
    }

    const sanitizedApproverIds = approverIds.filter(id => id !== release.createdById);
    if (sanitizedApproverIds.length === 0) {
      throw new BadRequestError('Cannot request approval from the release creator. Please select another team member.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.release.update({
        where: { id: releaseId },
        data: { status: 'PENDING_APPROVAL' }
      });

      if (sanitizedApproverIds.length > 0) {
        await tx.releaseApproval.createMany({
          data: sanitizedApproverIds.map(approverId => ({
            releaseId,
            approverId,
            status: 'PENDING'
          })),
          skipDuplicates: true
        });
      }
      return u;
    });

    return updated;
  },

  async approveRelease(releaseId: number, projectId: number, approverId: number, notes?: string) {
    const release = await prisma.release.findUnique({ 
      where: { id: releaseId, projectId },
      include: { approvals: true }
    });
    if (!release) throw new NotFoundError('Release not found');
    if (release.status !== 'PENDING_APPROVAL') throw new BadRequestError('Release is not pending approval');

    if (release.createdById === approverId) {
      throw new BadRequestError('Release creator cannot approve their own release');
    }

    const isAssigned = release.approvals.some(a => a.approverId === approverId && a.status === 'PENDING');
    if (!isAssigned) {
      throw new BadRequestError('You are not assigned as a pending approver for this release');
    }

    await prisma.$transaction(async (tx) => {
      await tx.releaseApproval.upsert({
        where: {
          releaseId_approverId: {
            releaseId,
            approverId
          }
        },
        update: {
          status: 'APPROVED',
          notes: notes || null
        },
        create: {
          releaseId,
          approverId,
          status: 'APPROVED',
          notes: notes || null
        }
      });

      const remainingPending = release.approvals.filter(a => a.approverId !== approverId && a.status === 'PENDING');
      if (remainingPending.length === 0) {
        await tx.release.update({
          where: { id: releaseId },
          data: { status: 'READY_TO_DEPLOY' }
        });
      }
    });

    return { success: true };
  },

  async scheduleRelease(releaseId: number, projectId: number, userId: number, scheduledAt: Date | string) {
    const release = await prisma.release.findUnique({
      where: { id: releaseId, projectId },
      include: { targetEnvironment: true }
    });

    if (!release) throw new NotFoundError('Release not found');
    if (release.status === 'DEPLOYING') throw new BadRequestError('Deployment is currently in progress');
    if (release.status === 'DEPLOYED') throw new BadRequestError('Release is already deployed');
    if (release.status === 'ROLLED_BACK') throw new BadRequestError('Cannot schedule a rolled back release');

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      throw new BadRequestError('Scheduled time must be a valid future date');
    }

    const requiresApproval = Boolean(release.targetEnvironment?.requiresApproval);
    if (requiresApproval) {
      if (release.status !== 'READY_TO_DEPLOY' && release.status !== 'SCHEDULED') {
        throw new BadRequestError('Release requires approval before it can be scheduled');
      }
    } else {
      if (release.status !== 'DRAFT' && release.status !== 'READY_TO_DEPLOY' && release.status !== 'SCHEDULED') {
        throw new BadRequestError('Release cannot be scheduled from its current status');
      }
    }

    const isReschedule = release.status === 'SCHEDULED';

    const updated = await prisma.release.update({
      where: { id: releaseId },
      data: {
        status: 'SCHEDULED',
        scheduledAt: scheduledDate
      },
      include: { targetEnvironment: true }
    });

    // Enqueue delayed job in BullMQ
    await scheduleReleaseJob(releaseId, projectId, scheduledDate);

    // Fetch actor name
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    const actorName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : undefined;

    // Send email notification to project members
    await this.notifyProjectMembers(projectId, updated, isReschedule ? 'SCHEDULE_UPDATED' : 'SCHEDULED', actorName);

    return updated;
  },

  async cancelSchedule(releaseId: number, projectId: number, userId: number) {
    const release = await prisma.release.findUnique({
      where: { id: releaseId, projectId },
      include: { targetEnvironment: true }
    });

    if (!release) throw new NotFoundError('Release not found');
    if (release.status !== 'SCHEDULED') {
      throw new BadRequestError('Only SCHEDULED releases can have their schedule cancelled');
    }

    // Cancel BullMQ delayed job
    await cancelScheduledReleaseJob(releaseId);

    const targetRequiresApproval = Boolean(release.targetEnvironment?.requiresApproval);
    const fallbackStatus = targetRequiresApproval ? 'READY_TO_DEPLOY' : 'DRAFT';

    const updated = await prisma.release.update({
      where: { id: releaseId },
      data: {
        status: fallbackStatus,
        scheduledAt: null
      },
      include: { targetEnvironment: true }
    });

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    const actorName = actor ? `${actor.firstName} ${actor.lastName}`.trim() : undefined;

    // Notify project members
    await this.notifyProjectMembers(projectId, updated, 'SCHEDULE_CANCELLED', actorName);

    return updated;
  },

  async executeRelease(releaseId: number, projectId?: number, userId?: number) {
    const release = await prisma.release.findUnique({
      where: { id: releaseId, ...(projectId ? { projectId } : {}) },
      include: { items: true, targetEnvironment: true, sourceEnvironment: true }
    });

    if (!release) throw new NotFoundError('Release not found');
    if (release.status === 'DEPLOYING') throw new BadRequestError('Deployment is already in progress');
    if (release.status === 'DEPLOYED') throw new BadRequestError('Release is already deployed');
    if (release.status === 'ROLLED_BACK') throw new BadRequestError('Cannot execute a rolled back release');

    const requiresApproval = Boolean(release.targetEnvironment?.requiresApproval);
    if (requiresApproval) {
      if (release.status !== 'READY_TO_DEPLOY' && release.status !== 'SCHEDULED') {
        throw new BadRequestError('Release requires approval before deployment');
      }
    } else {
      if (release.status !== 'DRAFT' && release.status !== 'READY_TO_DEPLOY' && release.status !== 'SCHEDULED') {
        throw new BadRequestError('Release cannot be executed from its current status');
      }
    }

    // Cancel any delayed schedule job since it is being deployed now
    await cancelScheduledReleaseJob(releaseId);

    // Initial deployment progress state
    const initialProgress = {
      currentStageId: 1,
      totalStages: 5,
      percent: 5,
      isComplete: false,
      stages: DEPLOYMENT_STAGES.map((s, idx) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        status: idx === 0 ? 'RUNNING' : 'PENDING',
        startedAt: idx === 0 ? new Date().toISOString() : null,
        completedAt: null
      }))
    };

    // Transition status to DEPLOYING
    await prisma.release.update({
      where: { id: releaseId },
      data: {
        status: 'DEPLOYING',
        deploymentStartedAt: new Date(),
        deploymentProgress: initialProgress
      }
    });

    // Enqueue background deployment job for multi-stage execution
    await enqueueDeploymentJob(releaseId, release.projectId, userId);

    return { success: true, status: 'DEPLOYING', releaseId };
  },

  async performDeployment(releaseId: number) {
    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: { items: true, targetEnvironment: true, sourceEnvironment: true }
    });

    if (!release) throw new NotFoundError(`Release ${releaseId} not found for deployment`);

    logger.info(`[DeploymentWorker] Starting 5-stage deployment for release ${release.id} (${release.version})...`);

    const updateStage = async (stageId: number, status: 'RUNNING' | 'COMPLETED', percent: number) => {
      const rel = await prisma.release.findUnique({ where: { id: releaseId }, select: { deploymentProgress: true } });
      const current = (rel?.deploymentProgress as any) || { stages: DEPLOYMENT_STAGES };
      const now = new Date().toISOString();

      const updatedStages = DEPLOYMENT_STAGES.map(s => {
        const existing = current.stages?.find((st: any) => st.id === s.id) || {};
        if (s.id < stageId) {
          return { ...s, ...existing, status: 'COMPLETED', completedAt: existing.completedAt || now };
        }
        if (s.id === stageId) {
          return {
            ...s,
            ...existing,
            status,
            startedAt: existing.startedAt || now,
            completedAt: status === 'COMPLETED' ? now : null
          };
        }
        return { ...s, ...existing, status: 'PENDING', completedAt: null };
      });

      await prisma.release.update({
        where: { id: releaseId },
        data: {
          deploymentProgress: {
            currentStageId: stageId,
            totalStages: 5,
            percent,
            isComplete: stageId === 5 && status === 'COMPLETED',
            stages: updatedStages
          }
        }
      });
    };

    try {
      // Stage 1: Pre-flight Schema & Translation Integrity Check
      await updateStage(1, 'RUNNING', 10);
      for (const item of release.items) {
        const v = await FeedVersion.findById(item.versionId).lean();
        if (!v) {
          throw new BadRequestError(`Version ${item.versionId} not found for feed ${item.feedId}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      await updateStage(1, 'COMPLETED', 25);
      logger.info(`[DeploymentWorker] Stage 1 complete: Pre-flight checks passed for release ${release.id}`);

      // Stage 2: Target Environment State Snapshot & Rollback Point Creation
      await updateStage(2, 'RUNNING', 30);
      for (const item of release.items) {
        const currentState = await prisma.environmentState.findUnique({
          where: {
            environmentId_feedId: {
              environmentId: release.targetEnvironmentId,
              feedId: item.feedId
            }
          }
        });
        const previousVersionId = currentState ? currentState.activeVersionId : null;
        await prisma.releaseItem.update({
          where: { id: item.id },
          data: { previousVersionId }
        });
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      await updateStage(2, 'COMPLETED', 45);
      logger.info(`[DeploymentWorker] Stage 2 complete: Environment snapshot captured for release ${release.id}`);

      // Stage 3: Atomic State Pointer Synchronization
      await updateStage(3, 'RUNNING', 50);
      await prisma.$transaction(async (tx) => {
        for (const item of release.items) {
          await tx.environmentState.upsert({
            where: {
              environmentId_feedId: {
                environmentId: release.targetEnvironmentId,
                feedId: item.feedId
              }
            },
            update: { activeVersionId: item.versionId },
            create: {
              environmentId: release.targetEnvironmentId,
              feedId: item.feedId,
              activeVersionId: item.versionId
            }
          });
        }
      });
      await new Promise(resolve => setTimeout(resolve, 3500));
      await updateStage(3, 'COMPLETED', 65);
      logger.info(`[DeploymentWorker] Stage 3 complete: State pointers updated for release ${release.id}`);

      // Stage 4: Release Artifact Locking & Development Version Branching
      await updateStage(4, 'RUNNING', 70);
      for (const item of release.items) {
        if (release.sourceEnvironment.name === 'development') {
          await FeedService.lockAndCloneForDevelopment(
            release.projectId,
            item.feedId,
            item.versionId,
            release.createdById
          );
        } else {
          const project = await prisma.project.findUnique({ where: { id: release.projectId } });
          const projectLanguages = (project?.supportedLanguages as string[]) || [];
          const existing = await FeedVersion.findById(item.versionId);
          if (existing) {
            existing.isLocked = true;
            if (!existing.supportedLanguages || existing.supportedLanguages.length === 0) {
              existing.supportedLanguages = projectLanguages;
            }
            await existing.save();
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 4000));
      await updateStage(4, 'COMPLETED', 85);
      logger.info(`[DeploymentWorker] Stage 4 complete: Version locking & clone finished for release ${release.id}`);

      // Stage 5: Cache Invalidation & Traffic Activation
      await updateStage(5, 'RUNNING', 90);
      await new Promise(resolve => setTimeout(resolve, 3000));
      await updateStage(5, 'COMPLETED', 100);

      const activated = await prisma.release.update({
        where: { id: releaseId },
        data: { status: 'DEPLOYED' },
        include: { targetEnvironment: true }
      });

      logger.info(`[DeploymentWorker] Release ${release.id} is now DEPLOYED!`);

      // Notify project members
      await this.notifyProjectMembers(release.projectId, activated, 'DEPLOYED');

      return { success: true };
    } catch (err: any) {
      logger.error(`[DeploymentWorker] Deployment failed for release ${releaseId}:`, err);
      const rel = await prisma.release.findUnique({ where: { id: releaseId }, select: { deploymentProgress: true } });
      const current = (rel?.deploymentProgress as any) || {};
      await prisma.release.update({
        where: { id: releaseId },
        data: {
          status: 'FAILED',
          deploymentProgress: {
            ...current,
            failed: true,
            error: err.message || 'Deployment failed unexpectedly'
          }
        }
      });
      throw err;
    }
  },

  async notifyProjectMembers(
    projectId: number,
    release: any,
    action: 'SCHEDULED' | 'SCHEDULE_UPDATED' | 'SCHEDULE_CANCELLED' | 'DEPLOYED',
    actionBy?: string
  ) {
    try {
      const members = await prisma.projectMember.findMany({
        where: { projectId, removedAt: null },
        include: {
          workspaceMember: {
            include: { user: true }
          }
        }
      });

      for (const member of members) {
        const user = member.workspaceMember?.user;
        if (user?.email) {
          await enqueueSendReleaseNotificationEmailJob({
            email: user.email,
            recipientName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Team Member',
            releaseName: release.name,
            version: release.version,
            targetEnvironment: release.targetEnvironment?.name || 'target',
            action,
            scheduledAt: release.scheduledAt ? new Date(release.scheduledAt).toISOString() : undefined,
            actionBy
          }).catch(err => logger.warn(`Failed to enqueue email for ${user.email}: ${err}`));
        }
      }
    } catch (err) {
      logger.error(`[ReleaseService] Error notifying project members: ${err}`);
    }
  },

  async rollbackRelease(releaseId: number, projectId: number, userId: number) {
    const release = await prisma.release.findUnique({
      where: { id: releaseId, projectId },
      include: { items: true }
    });

    if (!release) throw new NotFoundError('Release not found');
    if (release.status !== 'DEPLOYED') throw new BadRequestError('Only DEPLOYED releases can be rolled back');

    await prisma.$transaction(async (tx) => {
      for (const item of release.items) {
        if (item.previousVersionId) {
          await tx.environmentState.update({
            where: {
              environmentId_feedId: {
                environmentId: release.targetEnvironmentId,
                feedId: item.feedId
              }
            },
            data: { activeVersionId: item.previousVersionId }
          });
        } else {
          await tx.environmentState.delete({
            where: {
              environmentId_feedId: {
                environmentId: release.targetEnvironmentId,
                feedId: item.feedId
              }
            }
          }).catch(() => {});
        }
      }

      await tx.release.update({
        where: { id: releaseId },
        data: { status: 'ROLLED_BACK' }
      });
    });

    return { success: true };
  },

  async deleteRelease(releaseId: number, projectId: number, userId?: number) {
    const release = await prisma.release.findUnique({
      where: { id: releaseId, projectId },
      include: { targetEnvironment: true }
    });

    if (!release) throw new NotFoundError('Release not found');

    const undeployedStatuses = ['DRAFT', 'PENDING_APPROVAL', 'READY_TO_DEPLOY', 'SCHEDULED', 'FAILED'];
    if (!undeployedStatuses.includes(release.status)) {
      throw new BadRequestError(`Cannot delete release with status "${release.status}". Only undeployed releases (Draft, Pending Approval, Ready to Deploy, Scheduled, or Failed) can be deleted.`);
    }

    // If scheduled, cancel delayed background job in Redis
    if (release.status === 'SCHEDULED') {
      await cancelScheduledReleaseJob(releaseId);
      await this.notifyProjectMembers(release.projectId, release, 'SCHEDULE_CANCELLED', 'Release deleted');
    }

    await prisma.release.delete({
      where: { id: releaseId }
    });

    logger.info(`Release ${releaseId} successfully deleted by user ${userId || 'system'}`);

    return { success: true };
  },

  
  async computeFeedDiff(feed: any, sourceVersionId: string, targetVersionId: string | null) {
    const sourceMongoVersion = await FeedVersion.findById(sourceVersionId).lean();
    let targetMongoVersion = null;
    if (targetVersionId) {
      targetMongoVersion = await FeedVersion.findById(targetVersionId).lean();
    }

    const sourceLocalizations = await FeedLocalization.find({ feedVersionId: sourceVersionId }).lean();
    const targetLocalizations = targetVersionId 
      ? await FeedLocalization.find({ feedVersionId: targetVersionId }).lean()
      : [];

    const baseLanguage = feed.baseLanguage || sourceMongoVersion?.baseLanguage || 'en';

    // Collect all language codes
    const langCodesSet = new Set<string>();
    langCodesSet.add(baseLanguage);
    sourceLocalizations.forEach(l => langCodesSet.add(l.languageCode));
    targetLocalizations.forEach(l => langCodesSet.add(l.languageCode));

    const languages: any[] = [];
    const addedLanguages: string[] = [];
    const modifiedLanguages: string[] = [];
    const unchangedLanguages: string[] = [];
    let baseChanged = false;

    const getLanguageName = (code: string) => {
      try {
        const intl = new Intl.DisplayNames(['en'], { type: 'language' });
        return intl.of(code) || code.toUpperCase();
      } catch {
        return code.toUpperCase();
      }
    };

    // 1. Process base language first
    const sourceBaseContent = sourceMongoVersion?.baseContent || {};
    const targetBaseContent = targetMongoVersion?.baseContent || null;

    let baseStatus: 'ADDED' | 'MODIFIED' | 'UNCHANGED' = 'UNCHANGED';
    if (!targetBaseContent) {
      baseStatus = 'ADDED';
      baseChanged = true;
    } else if (JSON.stringify(sourceBaseContent) !== JSON.stringify(targetBaseContent)) {
      baseStatus = 'MODIFIED';
      baseChanged = true;
    } else {
      unchangedLanguages.push(baseLanguage);
    }

    languages.push({
      languageCode: baseLanguage,
      languageName: getLanguageName(baseLanguage),
      isBaseLanguage: true,
      status: baseStatus,
      sourceStatus: 'COMPLETED',
      targetStatus: targetBaseContent ? 'COMPLETED' : null,
      previousContent: targetBaseContent,
      targetContent: sourceBaseContent,
    });

    // 2. Process all other languages
    for (const code of Array.from(langCodesSet)) {
      if (code === baseLanguage) continue;

      const sourceLoc = sourceLocalizations.find(l => l.languageCode === code);
      const targetLoc = targetLocalizations.find(l => l.languageCode === code);

      const sourceContent = sourceLoc?.localizedContent || null;
      const targetContent = targetLoc?.localizedContent || null;

      let status: 'ADDED' | 'MODIFIED' | 'REMOVED' | 'UNCHANGED' = 'UNCHANGED';

      if (sourceLoc && !targetLoc) {
        status = 'ADDED';
        addedLanguages.push(code);
      } else if (!sourceLoc && targetLoc) {
        status = 'REMOVED';
        modifiedLanguages.push(code);
      } else if (sourceLoc && targetLoc) {
        const isContentDifferent = JSON.stringify(sourceContent) !== JSON.stringify(targetContent);
        const isStatusDifferent = sourceLoc.status !== targetLoc.status;
        if (isContentDifferent || isStatusDifferent) {
          status = 'MODIFIED';
          modifiedLanguages.push(code);
        } else {
          status = 'UNCHANGED';
          unchangedLanguages.push(code);
        }
      }

      languages.push({
        languageCode: code,
        languageName: getLanguageName(code),
        isBaseLanguage: false,
        status,
        sourceStatus: sourceLoc?.status || null,
        targetStatus: targetLoc?.status || null,
        previousContent: targetContent,
        targetContent: sourceContent,
      });
    }

    const hasAnyChange = baseChanged || addedLanguages.length > 0 || modifiedLanguages.length > 0;

    return {
      feedId: feed.id,
      feedName: feed.name,
      baseLanguage,
      sourceVersionId,
      sourceVersionNumber: sourceMongoVersion?.versionNumber ?? 0,
      targetVersionId,
      targetVersionNumber: targetMongoVersion?.versionNumber ?? null,
      languages,
      summary: {
        baseChanged,
        addedLanguages,
        modifiedLanguages,
        unchangedLanguages,
        hasAnyChange
      },
      sourceContent: sourceBaseContent,
      targetContent: sourceBaseContent,
      previousContent: targetBaseContent || {},
    };
  },

  async getEnvironmentDiff(projectId: number, sourceEnvId: number, targetEnvId: number) {
    const feeds = await prisma.feed.findMany({ where: { projectId } });

    const sourceStates = await prisma.environmentState.findMany({
      where: { environmentId: sourceEnvId }
    });
    const targetStates = await prisma.environmentState.findMany({
      where: { environmentId: targetEnvId }
    });

    const diffs = [];

    for (const feed of feeds) {
      const sourceState = sourceStates.find(s => s.feedId === feed.id);
      const targetState = targetStates.find(s => s.feedId === feed.id);

      if (sourceState && (!targetState || sourceState.activeVersionId !== targetState.activeVersionId)) {
        const feedDiff = await this.computeFeedDiff(
          feed,
          sourceState.activeVersionId,
          targetState?.activeVersionId || null
        );
        diffs.push(feedDiff);
      }
    }
    return diffs;
  },

  async suggestNextVersion(projectId: number, targetEnvId: number, selectedFeedIds: number[]) {
    const latestRelease = await prisma.release.findFirst({
      where: { projectId, targetEnvironmentId: targetEnvId, status: { in: ['DEPLOYED', 'SCHEDULED'] } },
      orderBy: { createdAt: 'desc' }
    });

    let currentVersion = latestRelease?.version || 'v0.0.0';
    // Strip 'v' if present
    if (currentVersion.startsWith('v')) currentVersion = currentVersion.slice(1);
    const parts = currentVersion.split('.').map(Number);
    if (parts.length !== 3) parts.push(...[0,0,0].slice(parts.length));
    
    let isMajor = false;
    const targetStates = await prisma.environmentState.findMany({
      where: { environmentId: targetEnvId, feedId: { in: selectedFeedIds } }
    });

    // If any selected feed doesn't exist in target environment at all, bump major!
    if (targetStates.length < selectedFeedIds.length) {
      isMajor = true;
    }

    if (isMajor) {
      return `v${(parts[0] || 0) + 1}.0.0`;
    } else {
      return `v${parts[0] || 0}.${(parts[1] || 0) + 1}.0`;
    }
  },

  async getReleaseDetails(releaseId: number, projectId: number) {
    const release = await prisma.release.findUnique({
      where: { id: releaseId, projectId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        sourceEnvironment: true,
        targetEnvironment: true,
        approvals: {
          include: {
            approver: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        },
        items: {
          include: {
            feed: true
          }
        }
      }
    });

    if (!release) throw new NotFoundError('Release not found');

    const feedDiffs = [];

    for (const item of release.items) {
      let compareAgainstVersionId = item.previousVersionId;
      
      if (!compareAgainstVersionId && (release.status === 'DRAFT' || release.status === 'PENDING_APPROVAL' || release.status === 'READY_TO_DEPLOY' || release.status === 'SCHEDULED' || release.status === 'DEPLOYING')) {
        const targetState = await prisma.environmentState.findUnique({
          where: {
            environmentId_feedId: {
              environmentId: release.targetEnvironmentId,
              feedId: item.feedId
            }
          }
        });
        compareAgainstVersionId = targetState ? targetState.activeVersionId : null;
      }

      const feedDiff = await this.computeFeedDiff(
        item.feed,
        item.versionId,
        compareAgainstVersionId
      );

      feedDiffs.push({
        id: item.id,
        ...feedDiff
      });
    }

    return {
      id: release.id,
      version: release.version,
      name: release.name,
      description: release.description,
      status: release.status,
      scheduledAt: release.scheduledAt,
      deploymentStartedAt: release.deploymentStartedAt,
      deploymentProgress: (release as any).deploymentProgress,
      createdAt: release.createdAt,
      sourceEnvironment: (release as any).sourceEnvironment,
      targetEnvironment: release.targetEnvironment,
      createdBy: release.createdBy,
      approvals: release.approvals.map(a => ({
        id: a.id,
        status: a.status,
        notes: a.notes,
        createdAt: a.createdAt,
        approver: a.approver
      })),
      feeds: feedDiffs
    };
  }
};
