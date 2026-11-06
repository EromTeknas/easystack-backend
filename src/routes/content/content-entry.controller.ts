import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError } from '../../errors';
import { ContentEntryService } from '../../services/content-entry.service';

/**
 * GET /api/projects/:projectId/content/:schemaSlug
 */
export const listContentEntries = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaSlug } = req.params;
  if (!projectId || !schemaSlug) {
    throw new BadRequestError('projectId and schemaSlug are required');
  }

  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const search = req.query.search as string | undefined;
  const status = req.query.status as any;
  const environment = (req.query.environment as string) || 'development';

  const result = await ContentEntryService.listEntries(projectId, schemaSlug, {
    page,
    limit,
    search,
    status,
    environment,
  });

  return ok(res, result);
});

/**
 * GET /api/projects/:projectId/content/:schemaSlug/check-slug?slug=...
 */
export const checkContentEntrySlug = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaSlug } = req.params;
  const slug = (req.query.slug as string || '').trim();
  const excludeId = req.query.excludeId as string | undefined;
  const environment = (req.query.environment as string) || 'development';

  const result = await ContentEntryService.checkSlugAvailability(
    projectId,
    schemaSlug,
    slug,
    excludeId,
    environment
  );
  return ok(res, result);
});

/**
 * GET /api/projects/:projectId/content/:schemaSlug/:entryId
 */
export const getContentEntry = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaSlug, entryId } = req.params;
  const environment = (req.query.environment as string) || 'development';

  const result = await ContentEntryService.getEntry(projectId, schemaSlug, entryId, environment);
  return ok(res, result);
});

/**
 * POST /api/projects/:projectId/content/:schemaSlug
 */
export const createContentEntry = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaSlug } = req.params;
  const userId = Number(req.user!.id);
  const { title, slug, status, environment, baseLanguage, content, translations } = req.body;
  const targetEnv = environment || (req.query.environment as string) || 'development';

  const entry = await ContentEntryService.createEntry(projectId, schemaSlug, userId, {
    title,
    slug,
    status,
    environment: targetEnv,
    baseLanguage,
    content: content || {},
    translations,
  });

  return ok(res, { entry, message: 'Content entry created successfully' });
});

/**
 * PUT /api/projects/:projectId/content/:schemaSlug/:entryId
 */
export const updateContentEntry = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaSlug, entryId } = req.params;
  const userId = Number(req.user!.id);
  const { title, slug, status, environment, baseLanguage, content, translations } = req.body;

  const entry = await ContentEntryService.updateEntry(projectId, schemaSlug, entryId, userId, {
    title,
    slug,
    status,
    environment,
    baseLanguage,
    content,
    translations,
  });

  return ok(res, { entry, message: 'Content entry updated successfully' });
});

/**
 * DELETE /api/projects/:projectId/content/:schemaSlug/:entryId
 */
export const deleteContentEntry = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaSlug, entryId } = req.params;
  const userId = Number(req.user?.id || 0);

  await ContentEntryService.deleteEntry(projectId, schemaSlug, entryId, userId);
  return ok(res, { message: 'Content entry deleted successfully' });
});

/**
 * POST /api/projects/:projectId/content/:schemaSlug/:entryId/publish
 */
export const publishContentEntry = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaSlug, entryId } = req.params;
  const userId = Number(req.user!.id);
  const targetEnv = (req.body?.targetEnv as string) || (req.query?.environment as string) || 'development';
  const forcePublish = Boolean(req.body?.forcePublish);

  const entry = await ContentEntryService.publishEntry(
    projectId,
    schemaSlug,
    entryId,
    userId,
    targetEnv,
    forcePublish
  );
  return ok(res, { entry, message: `Content entry published in ${targetEnv} successfully` });
});

/**
 * POST /api/projects/:projectId/content/:schemaSlug/:entryId/discard-draft
 */
export const discardContentEntryDraft = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaSlug, entryId } = req.params;
  const userId = Number(req.user!.id);
  const targetEnv = (req.body?.targetEnv as string) || (req.query?.environment as string) || 'development';

  const result = await ContentEntryService.discardDraft(projectId, schemaSlug, entryId, userId, targetEnv);
  return ok(res, result);
});

/**
 * POST /api/projects/:projectId/content/:schemaSlug/:entryId/translate
 */
export const triggerContentEntryTranslations = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaSlug, entryId } = req.params;
  const userId = Number(req.user!.id);
  const languages = req.body?.languages as string[] | undefined;

  const result = await ContentEntryService.triggerTranslations(
    projectId,
    schemaSlug,
    entryId,
    userId,
    languages
  );
  return ok(res, result);
});

/**
 * POST /api/projects/:projectId/content/:schemaSlug/:entryId/schedule
 */
export const scheduleContentEntry = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaSlug, entryId } = req.params;
  const userId = Number(req.user!.id);
  const { scheduledAt, targetEnv } = req.body;

  if (!scheduledAt) {
    throw new BadRequestError('scheduledAt is required for scheduled publication');
  }

  const entry = await ContentEntryService.scheduleEntry(
    projectId,
    schemaSlug,
    entryId,
    scheduledAt,
    userId,
    targetEnv || 'production'
  );
  return ok(res, { entry, message: 'Content entry scheduled for publication' });
});

/**
 * POST /api/projects/:projectId/content/sync-environments
 */
export const syncEnvironmentData = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const userId = Number(req.user?.id || 0);
  const { sourceEnv, targetEnv, schemaSlugs } = req.body;

  if (!sourceEnv || !targetEnv) {
    throw new BadRequestError('sourceEnv and targetEnv are required');
  }

  const result = await ContentEntryService.syncEnvironmentData(
    projectId,
    sourceEnv,
    targetEnv,
    schemaSlugs,
    userId
  );
  return ok(res, result);
});

/**
 * GET /api/projects/:projectId/content/:schemaSlug/:entryId/audit-logs
 */
export const getContentAuditLogs = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaSlug, entryId } = req.params;

  if (!projectId || !schemaSlug || !entryId) {
    throw new BadRequestError('projectId, schemaSlug and entryId are required');
  }

  const logs = await ContentEntryService.getAuditLogs(projectId, schemaSlug, entryId);
  return ok(res, logs);
});
