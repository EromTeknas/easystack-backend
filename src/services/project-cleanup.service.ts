import { FeedVersion } from '../models/feed-version.model';
import { FeedLocalization } from '../models/feed-localization.model';
import { FeedAuditLog } from '../models/feed-audit-log.model';
import { FeedComment } from '../models/feed-comment.model';
import { prisma } from '../db';
import { storageService } from './storage/storage.instance';
import logger from '../utils/logger';

export const cleanupProjectExternalData = async (projectId: number, feedIds: number[], projectResourceId: string) => {
  try {
    logger.info(`Starting external data cleanup for project ${projectId}`, { feedIds, projectResourceId });

    // 1. MONGODB CLEANUP
    if (feedIds.length > 0) {
      // Find all feed version IDs first
      const versions = await FeedVersion.find({ feedId: { $in: feedIds } }, { _id: 1 });
      const versionIds = versions.map(v => v._id);

      if (versionIds.length > 0) {
        // Delete localizations tied to these versions
        await FeedLocalization.deleteMany({ feedVersionId: { $in: versionIds } });
        // Delete the versions themselves
        await FeedVersion.deleteMany({ _id: { $in: versionIds } });
      }

      // Delete Audit Logs
      await FeedAuditLog.deleteMany({ feedId: { $in: feedIds } });
    }

    // Delete comments
    await FeedComment.deleteMany({ projectId });

    // 2. STORAGE ASSETS CLEANUP
    const assets = await prisma.storageAsset.findMany({
      where: {
        targetKey: {
          contains: `projects:${projectResourceId}`
        }
      }
    });

    if (assets.length > 0) {
      logger.info(`Found ${assets.length} storage assets to delete for project ${projectId}`);
      for (const asset of assets) {
        try {
          await storageService.deleteAsset({
            actorId: 'system',
            assetId: asset.id,
            target: asset.target as any
          });
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
