import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { ProjectAssetService } from '../../services/assets/project-asset.service';
import { BadRequestError } from '../../errors';

export const getStorageUsage = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  if (isNaN(projectId) || projectId <= 0) {
    throw new BadRequestError('Invalid project ID');
  }

  const usage = await ProjectAssetService.getStorageUsage(projectId);
  return ok(res, usage);
});

export const createUploadIntent = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const userId = Number(req.user.id);
  if (isNaN(projectId) || projectId <= 0) {
    throw new BadRequestError('Invalid project ID');
  }

  const { originalName, mimeType, sizeBytes } = req.body || {};
  const intent = await ProjectAssetService.createUploadIntent(projectId, userId, {
    originalName,
    mimeType,
    sizeBytes: Number(sizeBytes),
  });

  return ok(res, intent, { statusCode: 201 });
});

export const completeUpload = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const userId = Number(req.user.id);
  if (isNaN(projectId) || projectId <= 0) {
    throw new BadRequestError('Invalid project ID');
  }

  const { uploadId, altText, caption, width, height, duration } = req.body || {};
  const asset = await ProjectAssetService.completeUpload(projectId, userId, {
    uploadId,
    altText,
    caption,
    width: width ? Number(width) : undefined,
    height: height ? Number(height) : undefined,
    duration: duration ? Number(duration) : undefined,
  });

  return ok(res, { asset }, { statusCode: 201 });
});

export const listAssets = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  if (isNaN(projectId) || projectId <= 0) {
    throw new BadRequestError('Invalid project ID');
  }

  const fileType = typeof req.query?.fileType === 'string' ? req.query.fileType : undefined;
  const search = typeof req.query?.search === 'string' ? req.query.search : undefined;
  const page = req.query?.page ? Number(req.query.page) : 1;
  const limit = req.query?.limit ? Number(req.query.limit) : 30;

  const result = await ProjectAssetService.listAssets(projectId, {
    fileType,
    search,
    page,
    limit,
  });

  return ok(res, result);
});

export const getAsset = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const assetId = req.params.assetId;
  if (isNaN(projectId) || projectId <= 0) {
    throw new BadRequestError('Invalid project ID');
  }

  const asset = await ProjectAssetService.getAssetById(projectId, assetId);
  return ok(res, { asset });
});

export const updateAsset = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const assetId = req.params.assetId;
  if (isNaN(projectId) || projectId <= 0) {
    throw new BadRequestError('Invalid project ID');
  }

  const { name, altText, caption } = req.body || {};
  const updated = await ProjectAssetService.updateAssetMetadata(projectId, assetId, {
    name,
    altText,
    caption,
  });

  return ok(res, { asset: updated });
});

export const deleteAsset = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const assetId = req.params.assetId;
  const userId = Number(req.user.id);
  if (isNaN(projectId) || projectId <= 0) {
    throw new BadRequestError('Invalid project ID');
  }

  const result = await ProjectAssetService.deleteAsset(projectId, assetId, userId);
  return ok(res, result);
});
