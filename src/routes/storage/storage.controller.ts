import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { AppError, BadRequestError } from '../../errors';
import { s3 as s3Config } from '../../config';
import { S3Service } from '../../services/s3.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /storage/s3
 * Check S3 connectivity and bucket access
 */
export const checkS3 = asyncHandler(async (_req: any, res: Response) => {
  try {
    await S3Service.checkBucket();
  } catch (err: any) {
    console.error('S3 connectivity check failed:', err);
    const message = err instanceof Error ? err.message : 'S3 connectivity check failed';
    throw new AppError(message, 500, 'S3_CONNECTION_ERROR');
  }
  return ok(res, {
    ok: true,
    bucket: s3Config.bucket,
    region: s3Config.region
  });
});

/**
 * GET /storage/s3/files
 * List objects from the configured bucket
 */
export const listS3Objects = asyncHandler(async (req: any, res: Response) => {
    console.log('Received listS3Objects request with query:', req.query);
  const prefix = typeof req.query?.prefix === 'string' ? req.query.prefix : undefined;
  const maxKeysParam = typeof req.query?.maxKeys === 'string' ? req.query.maxKeys : undefined;
  const continuationToken =
    typeof req.query?.continuationToken === 'string' ? req.query.continuationToken : undefined;

  const maxKeys = maxKeysParam ? Number(maxKeysParam) : undefined;
  if (maxKeysParam && (Number.isNaN(maxKeys) || maxKeys! <= 0)) {
    throw new AppError('maxKeys must be a positive number', 400, 'INVALID_S3_MAX_KEYS');
  }

  const options = {
    ...(prefix ? { prefix } : {}),
    ...(typeof maxKeys === 'number' ? { maxKeys } : {}),
    ...(continuationToken ? { continuationToken } : {})
  };

  const result = await S3Service.listObjects(options);

  return ok(res, {
    ok: true,
    bucket: s3Config.bucket,
    prefix: prefix ?? null,
    items: result.items,
    isTruncated: result.isTruncated,
    nextToken: result.nextToken
  });
});

/**
 * PATCH /storage/s3
 * Upload a small test object to verify write access
 */
export const putS3TestObject = asyncHandler(async (req: any, res: Response) => {
  const key = req.body?.key || `healthcheck/${Date.now()}.txt`;
  const body = typeof req.body?.body === 'string' ? req.body.body : 's3-connection-ok';
  const contentType = req.body?.contentType || 'text/plain';

  if (!key) {
    throw new AppError('Object key is required', 400, 'INVALID_S3_KEY');
  }

  const result = await S3Service.putTestObject(key, body, contentType);

  return ok(res, {
    ok: true,
    bucket: s3Config.bucket,
    key,
    etag: result.ETag
  });
});

/**
 * DELETE /storage/s3
 * Delete an object to verify delete access
 */
export const deleteS3Object = asyncHandler(async (req: any, res: Response) => {
  const key = req.query?.key || req.body?.key;

  if (!key || typeof key !== 'string') {
    throw new AppError('Object key is required', 400, 'INVALID_S3_KEY');
  }

  await S3Service.deleteObject(key);

  return ok(res, {
    ok: true,
    bucket: s3Config.bucket,
    key
  });
});

type S3PathGenerator = (params: Record<string, string>) => string;

const S3_PATH_TEMPLATES: Record<string, S3PathGenerator> = {
  'workspace-logo': (params) => {
    const { workspaceId, filename } = params;
    if (!workspaceId) throw new BadRequestError('workspaceId is required for workspace-logo');
    return `workspace/${workspaceId}/logo/${filename}`;
  },
  'workspace-asset': (params) => {
    const { workspaceId, filename } = params;
    if (!workspaceId) throw new BadRequestError('workspaceId is required for workspace-asset');
    return `workspace/${workspaceId}/assets/${filename}`;
  },
  'user-avatar': (params) => {
    const { userId, filename } = params;
    if (!userId) throw new BadRequestError('userId is required for user-avatar');
    return `user/${userId}/avatar/${filename}`;
  },
  'project-file': (params) => {
    const { workspaceId, projectId, filename } = params;
    if (!workspaceId) throw new BadRequestError('workspaceId is required for project-file');
    if (!projectId) throw new BadRequestError('projectId is required for project-file');
    return `workspace/${workspaceId}/project/${projectId}/files/${filename}`;
  }
};

/**
 * POST /storage/upload-url
 * Generate a presigned URL for direct S3 upload
 * 
 * Request body:
 * - type: string (e.g., 'workspace-logo', 'user-avatar')
 * - contentType: string (e.g., 'image/png')
 * - fileExtension: string (e.g., 'png', 'jpg')
 * - workspaceId?: string (required for workspace-related uploads)
 * - projectId?: string (required for project-related uploads)
 * - userId?: string (required for user-related uploads)
 * - expiresIn?: number (optional, default 3600 seconds)
 */
export const generateUploadUrl = asyncHandler(async (req: any, res: Response) => {
  const { type, contentType, fileExtension, expiresIn = 3600, ...params } = req.body;

  // Validate required fields
  if (!type || typeof type !== 'string') {
    throw new BadRequestError('type is required and must be a string');
  }

  if (!contentType || typeof contentType !== 'string') {
    throw new BadRequestError('contentType is required and must be a string');
  }

  if (!fileExtension || typeof fileExtension !== 'string') {
    throw new BadRequestError('fileExtension is required and must be a string');
  }

  // Validate type
  const pathGenerator = S3_PATH_TEMPLATES[type];
  if (!pathGenerator) {
    throw new BadRequestError(
      `Invalid upload type '${type}'. Supported types: ${Object.keys(S3_PATH_TEMPLATES).join(', ')}`
    );
  }

  // Generate unique filename
  const uuid = uuidv4();
  const filename = `${uuid}.${fileExtension}`;

  // Generate S3 path
  const s3Key = pathGenerator({ ...params, filename });

  // Generate presigned URL
  const uploadUrl = await S3Service.generatePresignedUploadUrl(s3Key, contentType, expiresIn);

  return ok(res, {
    uploadUrl,
    key: s3Key,
    bucket: s3Config.bucket,
    expiresIn,
    publicUrl: s3Config.endpoint
      ? `${s3Config.endpoint}/${s3Config.bucket}/${s3Key}`
      : `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com/${s3Key}`
  });
});

/**
 * GET /storage/get-url
 * Generate a presigned URL for direct S3 object download
 *
 * Query params:
 * - key: string (required)
 * - expiresIn?: number (optional, default 3600 seconds)
 */
export const generateGetUrl = asyncHandler(async (req: any, res: Response) => {
  const key = typeof req.query?.key === 'string' ? req.query.key : undefined;
  const expiresInRaw = req.query?.expiresIn;
  const expiresIn =
    typeof expiresInRaw === 'string' && expiresInRaw.trim().length > 0 ? Number(expiresInRaw) : 3600;

  if (!key) {
    throw new BadRequestError('key is required and must be a string');
  }

  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new BadRequestError('expiresIn must be a positive number');
  }

  const downloadUrl = await S3Service.generatePresignedGetUrl(key, expiresIn);

  return ok(res, {
    downloadUrl,
    key,
    bucket: s3Config.bucket,
    expiresIn
  });
});

import { storageService } from '../../services/storage/storage.instance';
import { STORAGE_PRESETS, PresetName } from '../../config/storage.presets';
import { StorageTarget } from '../../services/storage/public/storage.contracts';

export const createUploadIntent = asyncHandler(async (req: any, res: Response) => {
  const userId = String(req.user!.id);
  const presetName = req.body?.preset as string;
  
  if (!presetName || !(presetName in STORAGE_PRESETS)) {
    throw new BadRequestError(`preset must be one of: ${Object.keys(STORAGE_PRESETS).join(", ")}`);
  }

  const presetConfig = STORAGE_PRESETS[presetName as PresetName];

  const nodes = req.body?.targetNodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new BadRequestError("targetNodes array is required");
  }

  const normalizedNodes = nodes.map(n => ({
    collection: typeof n.collection === "string" ? n.collection.trim() : String(n.collection),
    id: typeof n.id === "string" ? n.id.trim() : String(n.id)
  }));

  const target: StorageTarget = {
    nodes: normalizedNodes,
    slot: presetConfig.slot,
  };

  const file = req.body?.file;
  if (!file || typeof file.originalName !== "string" || typeof file.mimeType !== "string" || typeof file.sizeBytes !== "number") {
      throw new BadRequestError("file must contain originalName, mimeType, and sizeBytes");
  }

  const result = await storageService.createUploadIntent({
    actorId: userId,
    target,
    fileClass: presetConfig.fileClass,
    file,
    policy: presetConfig.policy,
  });

  return ok(res, {
    uploadId: result.uploadId,
    upload: result.upload,
  }, { statusCode: 201 });
});

export const completeUpload = asyncHandler(async (req: any, res: Response) => {
  const userId = String(req.user!.id);
  const uploadId = req.params.uploadId;

  if (!uploadId || typeof uploadId !== "string") {
    throw new BadRequestError("uploadId is required");
  }

  const asset = await storageService.completeUpload({ actorId: userId, uploadId });

  return ok(res, { asset });
});
