import { SchemaBlueprint } from '../models/schema-blueprint.model';
import { SchemaBlueprintVersion } from '../models/schema-blueprint-version.model';
import { ContentEntry } from '../models/content-entry.model';
import { ContentAuditLog } from '../models/content-audit-log.model';
import { ProjectLanguageAuditLog } from '../models/project-language-audit-log.model';
import { prisma } from '../db';
import { storageService } from './storage/storage.instance';
import { deletionLogger as logger } from '../utils/logger';

export const cleanupProjectExternalData = async (projectId: number, projectResourceId: string) => {
  try {
    logger.info(`Starting external data cleanup for project ${projectId}`, { projectResourceId });

    // Clean up MongoDB entities
    await ContentEntry.deleteMany({ projectId });
    await ContentAuditLog.deleteMany({ projectId });
    await SchemaBlueprintVersion.deleteMany({ projectId });
    await SchemaBlueprint.deleteMany({ projectId });
    await ProjectLanguageAuditLog.deleteMany({ projectId });

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

export const cleanupWorkspaceExternalData = async (workspaceId: number, projectIds: number[], workspaceResourceId: string) => {
  try {
    logger.info(`Starting external data cleanup for workspace ${workspaceId}`, { projectIds, workspaceResourceId });

    if (projectIds.length > 0) {
      await ContentEntry.deleteMany({ projectId: { $in: projectIds } });
      await ContentAuditLog.deleteMany({ projectId: { $in: projectIds } });
      await SchemaBlueprintVersion.deleteMany({ projectId: { $in: projectIds } });
      await SchemaBlueprint.deleteMany({ projectId: { $in: projectIds } });
      await ProjectLanguageAuditLog.deleteMany({ projectId: { $in: projectIds } });
    }

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
