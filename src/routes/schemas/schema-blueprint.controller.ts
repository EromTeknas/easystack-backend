import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError } from '../../errors';
import { SchemaBlueprintService } from '../../services/schema-blueprint.service';

/**
 * GET /api/projects/:projectId/schemas
 */
export const listSchemas = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  if (!projectId) {
    throw new BadRequestError('projectId is required');
  }

  const environment = req.query.environment as string | undefined;
  const schemas = await SchemaBlueprintService.listSchemas(projectId, environment);
  return ok(res, { schemas });
});

/**
 * GET /api/projects/:projectId/schemas/check-slug?slug=...
 */
export const checkSchemaSlug = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const slug = (req.query.slug as string || '').trim();
  const excludeId = req.query.excludeId as string | undefined;

  const result = await SchemaBlueprintService.checkSlugAvailability(projectId, slug, excludeId);
  return ok(res, result);
});

/**
 * GET /api/projects/:projectId/schemas/:schemaId
 */
export const getSchema = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaId } = req.params;
  const environment = req.query.environment as string | undefined;

  const schema = await SchemaBlueprintService.getSchemaById(projectId, schemaId, environment);
  return ok(res, { schema });
});

/**
 * POST /api/projects/:projectId/schemas
 */
export const createSchema = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const userId = Number(req.user!.id);
  const { name, slug, description, type, icon, schemaDefinition } = req.body;

  const schema = await SchemaBlueprintService.createSchema(projectId, userId, {
    name,
    slug,
    description,
    type,
    icon,
    schemaDefinition,
  });

  return ok(res, { schema, message: 'Schema blueprint created successfully' });
});

/**
 * PUT /api/projects/:projectId/schemas/:schemaId
 */
export const updateSchema = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaId } = req.params;
  const { name, slug, description, type, icon, schemaDefinition } = req.body;

  const schema = await SchemaBlueprintService.updateSchema(projectId, schemaId, {
    name,
    slug,
    description,
    type,
    icon,
    schemaDefinition,
  });

  return ok(res, { schema, message: 'Schema blueprint updated successfully' });
});

/**
 * DELETE /api/projects/:projectId/schemas/:schemaId
 */
export const deleteSchema = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaId } = req.params;

  await SchemaBlueprintService.deleteSchema(projectId, schemaId);
  return ok(res, { message: 'Schema blueprint deleted successfully' });
});

/**
 * POST /api/projects/:projectId/schemas/:schemaId/deploy
 */
export const deploySchema = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { schemaId } = req.params;
  const userId = Number(req.user!.id);
  const { targetEnvironment } = req.body;

  if (!targetEnvironment) {
    throw new BadRequestError('targetEnvironment is required (e.g. staging, production)');
  }

  const result = await SchemaBlueprintService.deployBlueprint(
    projectId,
    schemaId,
    targetEnvironment,
    userId
  );
  return ok(res, result);
});

