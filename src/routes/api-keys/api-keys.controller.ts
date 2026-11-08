import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError } from '../../errors';
import { ApiKeyAuthService } from '../../delivery/services/api-key-auth.service';

/**
 * GET /api/projects/:projectId/api-keys
 */
export const listApiKeys = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  if (!projectId || !Number.isInteger(projectId)) {
    throw new BadRequestError('Valid projectId is required');
  }

  const environmentId = req.query.environmentId ? Number(req.query.environmentId) : undefined;
  const apiKeys = await ApiKeyAuthService.listKeys(projectId, environmentId);

  return ok(res, { apiKeys });
});

/**
 * POST /api/projects/:projectId/api-keys
 */
export const createApiKey = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  if (!projectId || !Number.isInteger(projectId)) {
    throw new BadRequestError('Valid projectId is required');
  }

  const { environmentId, name, rateLimitPerMinute, allowedOrigins } = req.body;

  if (!environmentId || !Number.isInteger(Number(environmentId))) {
    throw new BadRequestError('environmentId is required and must be an integer');
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new BadRequestError('API key name is required');
  }

  const result = await ApiKeyAuthService.createKey({
    projectId,
    environmentId: Number(environmentId),
    name: name.trim(),
    rateLimitPerMinute: rateLimitPerMinute ? Number(rateLimitPerMinute) : undefined,
    allowedOrigins: Array.isArray(allowedOrigins) ? allowedOrigins : undefined,
  });

  return ok(res, { apiKey: result.apiKey, rawKey: result.rawKey }, { statusCode: 201 });
});

/**
 * DELETE /api/projects/:projectId/api-keys/:apiKeyId
 */
export const revokeApiKey = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const apiKeyId = Number(req.params.apiKeyId);

  if (!projectId || !Number.isInteger(projectId)) {
    throw new BadRequestError('Valid projectId is required');
  }

  if (!apiKeyId || !Number.isInteger(apiKeyId)) {
    throw new BadRequestError('Valid apiKeyId is required');
  }

  const apiKey = await ApiKeyAuthService.revokeKey(apiKeyId, projectId);

  return ok(res, { apiKey });
});
