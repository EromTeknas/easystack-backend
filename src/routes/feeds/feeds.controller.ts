import { JsonValidationService, JsonValidationError } from "../../services/json-validation.service";
import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError } from '../../errors';
import { FeedService } from '../../services/feed.service';
import logger from '../../utils/logger';

/**
 * GET /api/projects/:projectId/feeds?env=development
 */
export const listFeeds = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const env = req.query.env as string || 'development';
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search as string | undefined;
  const sortBy = req.query.sortBy as string | undefined;
  const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
  const status = req.query.status as string | undefined;

  if (!projectId) {
    throw new BadRequestError('projectId is required');
  }

  const options: any = { page, limit };
  if (search) options.search = search;
  if (sortBy) options.sortBy = sortBy;
  if (sortOrder) options.sortOrder = sortOrder;
  if (status) options.status = status;

  const result = await FeedService.listFeeds(projectId, env, options);

  return ok(res, {
    feeds: result.feeds,
    pagination: result.pagination,
    environment: env
  });
});

/**
 * GET /api/projects/:projectId/feeds/check-name?name=homepage-hero
 */
export const checkFeedNameAvailability = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const name = req.query.name as string;

  if (!projectId) {
    throw new BadRequestError('projectId is required');
  }

  if (!name || typeof name !== 'string') {
    throw new BadRequestError('name query parameter is required');
  }

  const isAvailable = await FeedService.isFeedNameAvailable(projectId, name);

  return ok(res, {
    name,
    available: isAvailable,
    message: isAvailable ? 'Feed name is available' : 'A feed with this name already exists in this project'
  });
});

/**
 * POST /api/projects/:projectId/feeds
 */
export const createFeed = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const userId = Number(req.user!.id);
  const { name, baseLanguage, jsonContent, selectedKeys } = req.body;

  if (!projectId) {
    throw new BadRequestError('projectId is required');
  }

  if (!name || typeof name !== 'string') {
    throw new BadRequestError('Feed name is required');
  }

  if (!jsonContent || typeof jsonContent !== 'object') {
    throw new BadRequestError('jsonContent object is required');
  }

  const result = await FeedService.createFeed(projectId, userId, {
    name,
    baseLanguage,
    jsonContent,
    selectedKeys
  });

  return ok(res, result, { statusCode: 201 });
});

/**
 * GET /api/projects/:projectId/feeds/:feedId/localizations/status
 */
export const getLocalizationStatus = asyncHandler(async (req: any, res: Response) => {
  const feedId = Number(req.params.feedId);

  if (!feedId) {
    throw new BadRequestError('feedId is required');
  }

  const statuses = await FeedService.getLocalizationStatuses(feedId);

  return ok(res, statuses);
});

/**
 * GET /api/projects/:projectId/feeds/:feedId/localizations/:language/content
 */
export const getLocalizationContent = asyncHandler(async (req: any, res: Response) => {
  const feedId = Number(req.params.feedId);
  const { language } = req.params;

  if (!feedId || !language) {
    throw new BadRequestError('feedId and language are required');
  }

  const { content, selectedKeys } = await FeedService.getLocalizationContent(feedId, language);

  return ok(res, { language, content, selectedKeys });
});

/**
 * POST /api/projects/:projectId/feeds/:feedId/localizations/:language/retry
 */
export const retryLocalization = asyncHandler(async (req: any, res: Response) => {
  const feedId = Number(req.params.feedId);
  const { language } = req.params;
  const { selectedKeys } = req.body;

  if (!feedId || !language) {
    throw new BadRequestError('feedId and language are required');
  }

  await FeedService.retryLocalization(feedId, language, selectedKeys);

  return ok(res, { message: 'Translation queued successfully' });
});

/**
 * GET /api/projects/:projectId/feeds/:feedId
 */
export const getFeedDetail = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const feedId = Number(req.params.feedId);

  if (!projectId || !feedId) {
    throw new BadRequestError('projectId and feedId are required');
  }

  const feedDetail = await FeedService.getFeedDetail(projectId, feedId);

  return ok(res, feedDetail);
});

/**
 * POST /api/projects/:projectId/feeds/validate
 * Validates a JSON schema and selectedKeys without saving it.
 */
export const validateFeedSchema = asyncHandler(async (req: any, res: Response) => {
  const { jsonContent, selectedKeys } = req.body;

  if (!jsonContent || typeof jsonContent !== 'object') {
    throw new BadRequestError('jsonContent object is required for validation');
  }

  try {
    JsonValidationService.validate(jsonContent, selectedKeys);
    return ok(res, { message: 'JSON schema is valid' });
  } catch (error: any) {
    if (error instanceof JsonValidationError) {
      throw new BadRequestError(error.message);
    }
    throw error;
  }
});
