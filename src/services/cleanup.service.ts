import { FeedVersion } from '../models/feed-version.model';
import { FeedLocalization } from '../models/feed-localization.model';
import { FeedAuditLog } from '../models/feed-audit-log.model';
import { FeedComment } from '../models/feed-comment.model';
import { prisma } from '../db';
import { storageService } from './storage/storage.instance';
import { deletionLogger as logger } from '../utils/logger';

export const cleanupProjectExternalData = async (projectId: number, feedIds: number[], projectResourceId: string) => {
  try {
    logger.info(`Starting external data cleanup for project ${projectId}`, { feedIds, projectResourceId });

    if (feedIds.length > 0) {
      const versions = await FeedVersion.find({ feedId: { $in: feedIds } }, { _id: 1 });
      const versionIds = versions.map(v => v._id);

      if (versionIds.length > 0) {
        await FeedLocalization.deleteMany({ feedVersionId: { $in: versionIds } });
        await FeedVersion.deleteMany({ _id: { $in: versionIds } });
      }
      await FeedAuditLog.deleteMany({ feedId: { $in: feedIds } });
    }

    await FeedComment.deleteMany({ projectId });

    const assets = await prisma.storageAsset.findMany({
      where: { targetKey: { contains: `projects:${projectResourceId}` } }
    });

    if (assets.length > 0) {
      logger.info(`Found ${assets.length} storage assets to delete for project ${projectId}`);
      for (const asset of assets) {
        try {
          await storageService.deleteAsset({ actorId: 'system', assetId: asset.id, target: asset.target as any });
        } catch (assetErr) {
          logger.error(`Failed to delete asset ${asset.id} during project cleanup`, { err: assetErr });
        }
      }
    }

    logger.info(`Successfully completed external data cleanup for project ${projectId}`);
  } catch (error) {
    logger.error('Failed to cleanup project external data', { err: error, projectId });
  }
};

export const cleanupWorkspaceExternalData = async (workspaceId: number, projectIds: number[], feedIds: number[], workspaceResourceId: string) => {
  try {
    logger.info(`Starting external data cleanup for workspace ${workspaceId}`, { projectIds, feedIds, workspaceResourceId });

    if (feedIds.length > 0) {
      const versions = await FeedVersion.find({ feedId: { $in: feedIds } }, { _id: 1 });
      const versionIds = versions.map(v => v._id);

      if (versionIds.length > 0) {
        await FeedLocalization.deleteMany({ feedVersionId: { $in: versionIds } });
        await FeedVersion.deleteMany({ _id: { $in: versionIds } });
      }
      await FeedAuditLog.deleteMany({ feedId: { $in: feedIds } });
    }

    if (projectIds.length > 0) {
      await FeedComment.deleteMany({ projectId: { $in: projectIds } });
    }

    // This will delete all project assets inside the workspace, PLUS the workspace logo!
    // Because targetKey looks like workspaces:wrk_XXX/projects:prj_YYY OR workspaces:wrk_XXX
    const assets = await prisma.storageAsset.findMany({
      where: { targetKey: { contains: `workspaces:${workspaceResourceId}` } }
    });

    if (assets.length > 0) {
      logger.info(`Found ${assets.length} storage assets to delete for workspace ${workspaceId}`);
      for (const asset of assets) {
        try {
          await storageService.deleteAsset({ actorId: 'system', assetId: asset.id, target: asset.target as any });
        } catch (assetErr) {
          logger.error(`Failed to delete asset ${asset.id} during workspace cleanup`, { err: assetErr });
        }
      }
    }

    logger.info(`Successfully completed external data cleanup for workspace ${workspaceId}`);
  } catch (error) {
    logger.error('Failed to cleanup workspace external data', { err: error, workspaceId });
  }
};
