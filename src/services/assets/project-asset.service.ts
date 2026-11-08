import { prisma } from '../../db/prisma';
import { ProjectAssetRepository, ListProjectAssetsOptions } from '../../repositories/project-asset.repository';
import { storageService } from '../storage/storage.instance';
import {
  StorageFileClass,
  StorageTarget,
} from '../storage/public/storage.contracts';
import {
  STORAGE_PRESETS,
  PROJECT_ASSET_ALLOWED_MIME_TYPES,
} from '../../config/storage.presets';
import { BillingService } from '../billing/services/billing.service';
import { Quotas } from '../billing/config/quotas.config';
import { FreePlan } from '../billing/config/plans/free.plan';
import { AppError, BadRequestError, NotFoundError } from '../../errors';
import { s3 as s3Config } from '../../config';

export interface StorageUsageStats {
  usedBytes: number;
  limitBytes: number | null; // null indicates unlimited
  usedMB: number;
  limitMB: number | null;
  percentage: number;
  isQuotaExceeded: boolean;
}

export interface CreateAssetUploadIntentDto {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface CompleteAssetUploadDto {
  uploadId: string;
  altText?: string | undefined;
  caption?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  duration?: number | undefined;
}

function inferFileType(mimeType: string): 'image' | 'video' | 'document' {
  const normalized = mimeType.toLowerCase().trim();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('video/')) return 'video';
  return 'document';
}

function formatAssetResponse(asset: any) {
  if (!asset) return null;
  return {
    ...asset,
    sizeBytes: Number(asset.sizeBytes),
  };
}

export const ProjectAssetService = {
  async getProjectWithWorkspace(projectId: number) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, workspaceId: true },
    });
    if (!project) {
      throw new NotFoundError(`Project ${projectId} not found`);
    }
    return project;
  },

  async getStorageUsage(projectId: number): Promise<StorageUsageStats> {
    const project = await this.getProjectWithWorkspace(projectId);
    const usedBytesBigInt = await ProjectAssetRepository.getTotalStorageBytes(projectId);
    const usedBytes = Number(usedBytesBigInt);

    let limitMB: number | null = null;
    try {
      const quotaLimit = await BillingService.getLimit(project.workspaceId, Quotas.ASSET_STORAGE_MB.key);
      if (quotaLimit !== undefined) {
        limitMB = quotaLimit;
      }
    } catch {
      // Fallback to FreePlan default quota
      limitMB = (FreePlan.quotas as any)[Quotas.ASSET_STORAGE_MB.key] ?? 50;
    }

    if (limitMB === null) {
      // Enterprise or unlimited
      return {
        usedBytes,
        limitBytes: null,
        usedMB: Number((usedBytes / (1024 * 1024)).toFixed(2)),
        limitMB: null,
        percentage: 0,
        isQuotaExceeded: false,
      };
    }

    const limitBytes = limitMB * 1024 * 1024;
    const percentage = limitBytes > 0 ? Math.min(100, Number(((usedBytes / limitBytes) * 100).toFixed(1))) : 0;
    const isQuotaExceeded = usedBytes >= limitBytes;

    return {
      usedBytes,
      limitBytes,
      usedMB: Number((usedBytes / (1024 * 1024)).toFixed(2)),
      limitMB,
      percentage,
      isQuotaExceeded,
    };
  },

  async createUploadIntent(
    projectId: number,
    userId: number,
    dto: CreateAssetUploadIntentDto
  ) {
    if (!dto.originalName || typeof dto.originalName !== 'string') {
      throw new BadRequestError('originalName is required');
    }
    if (!dto.mimeType || typeof dto.mimeType !== 'string') {
      throw new BadRequestError('mimeType is required');
    }
    if (!dto.sizeBytes || typeof dto.sizeBytes !== 'number' || dto.sizeBytes <= 0) {
      throw new BadRequestError('sizeBytes must be a positive number');
    }

    const normalizedMimeType = dto.mimeType.toLowerCase().trim();
    const isAllowed = PROJECT_ASSET_ALLOWED_MIME_TYPES.some((m) => m === normalizedMimeType);
    if (!isAllowed) {
      throw new BadRequestError(
        `File format '${dto.mimeType}' is not supported. Allowed formats include JPEG, PNG, WebP, GIF, SVG, AVIF, MP4, WebM, QuickTime, and documents.`
      );
    }

    // Check plan storage limits
    const usage = await this.getStorageUsage(projectId);
    if (usage.limitBytes !== null) {
      if (usage.usedBytes + dto.sizeBytes > usage.limitBytes) {
        throw new AppError(
          `Storage limit reached. Uploading this file (${(dto.sizeBytes / (1024 * 1024)).toFixed(1)} MB) would exceed your plan storage limit of ${usage.limitMB} MB. Please upgrade your plan or delete existing media assets.`,
          402,
          'STORAGE_LIMIT_EXCEEDED'
        );
      }
    }

    const presetConfig = STORAGE_PRESETS['project-asset'];
    const target: StorageTarget = {
      nodes: [{ collection: 'projects', id: String(projectId) }],
      slot: presetConfig.slot,
    };

    const intent = await storageService.createUploadIntent({
      actorId: String(userId),
      target,
      fileClass: StorageFileClass.BINARY,
      file: {
        originalName: dto.originalName.trim(),
        mimeType: normalizedMimeType,
        sizeBytes: dto.sizeBytes,
      },
      policy: presetConfig.policy,
    });

    return {
      uploadId: intent.uploadId,
      upload: intent.upload,
    };
  },

  async completeUpload(
    projectId: number,
    userId: number,
    dto: CompleteAssetUploadDto
  ) {
    await this.getProjectWithWorkspace(projectId);

    if (!dto.uploadId || typeof dto.uploadId !== 'string') {
      throw new BadRequestError('uploadId is required');
    }

    // Promote uploaded file in S3 and create StorageAsset
    const storageAsset = await storageService.completeUpload({
      actorId: String(userId),
      uploadId: dto.uploadId,
    });

    const fileType = inferFileType(storageAsset.mimeType);

    // Build canonical public URL for high-performance direct CDN delivery
    const s3Key = storageAsset.targetKey;
    const publicUrl = storageAsset.access?.url
      ? storageAsset.access.url
      : s3Config.endpoint
      ? `${s3Config.endpoint}/${s3Config.bucket}/${s3Key}`
      : `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${s3Key}`;

    // Read original name from upload intent
    const intent = await prisma.storageUploadIntent.findUnique({
      where: { id: dto.uploadId },
      select: { originalName: true },
    });
    const filename = intent?.originalName || 'Untitled Asset';

    const projectAsset = await ProjectAssetRepository.create({
      projectId,
      storageAssetId: storageAsset.id,
      name: filename,
      altText: dto.altText || null,
      caption: dto.caption || null,
      fileType,
      mimeType: storageAsset.mimeType,
      sizeBytes: storageAsset.sizeBytes,
      publicUrl,
      width: dto.width ?? null,
      height: dto.height ?? null,
      duration: dto.duration ?? null,
      createdById: userId,
    });

    return formatAssetResponse(projectAsset);
  },

  async listAssets(projectId: number, options: ListProjectAssetsOptions = {}) {
    await this.getProjectWithWorkspace(projectId);
    const paginated = await ProjectAssetRepository.findByProjectId(projectId, options);
    return {
      ...paginated,
      assets: paginated.assets.map(formatAssetResponse),
    };
  },

  async getAssetById(projectId: number, assetId: string) {
    await this.getProjectWithWorkspace(projectId);
    const asset = await ProjectAssetRepository.findById(assetId);
    if (!asset || asset.projectId !== projectId) {
      throw new NotFoundError('Asset not found');
    }
    return formatAssetResponse(asset);
  },

  async updateAssetMetadata(
    projectId: number,
    assetId: string,
    data: { name?: string; altText?: string | null; caption?: string | null }
  ) {
    await this.getAssetById(projectId, assetId);
    const updated = await ProjectAssetRepository.update(assetId, data);
    return formatAssetResponse(updated);
  },

  async deleteAsset(projectId: number, assetId: string, userId: number) {
    const asset = await this.getAssetById(projectId, assetId);

    // Cleanup physical object in storage asynchronously
    try {
      const target: StorageTarget = {
        nodes: [{ collection: 'projects', id: String(projectId) }],
        slot: 'assets',
      };
      await storageService.deleteAsset({
        actorId: String(userId),
        assetId: asset.storageAssetId,
        target,
      });
    } catch (err) {
      console.error('Failed to trigger physical storage deletion for asset:', err);
    }

    // Soft delete in database
    await ProjectAssetRepository.softDelete(assetId);
    return { success: true, message: 'Asset deleted successfully' };
  },
};
