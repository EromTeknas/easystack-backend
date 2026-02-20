import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { AppError } from '../../errors';
import { s3 as s3Config } from '../../config';
import { S3Service } from '../../services/s3.service';

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
