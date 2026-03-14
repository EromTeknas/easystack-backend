import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError, InternalServerError, NotFoundError } from '../../errors';
import {
  addWorkspaceMember,
  createWorkspace,
  getUserWorkspaces,
  getWorkspaceWithRole
} from '../../services/workspace.service';
import { ImageUrlService } from '../../services/image-url.service';
import { isValidName } from '../../utils/validation';
import { prisma } from '../../db';
import logger from '../../utils/logger';
import { log } from 'node:console';

const normalizeWorkspace = (workspace: any) => {
  if (!workspace) return null;

  const createdAt = workspace.created_at ?? workspace.createdAt;
  const updatedAt = workspace.updated_at ?? workspace.updatedAt;

  return {
    id: workspace.id,
    name: workspace.name,
    logoUrl: workspace.logo_url ?? workspace.logoUrl ?? null,
    createdBy: workspace.created_by ?? workspace.createdBy ?? null,
    role: workspace.role ?? null,
    createdAt: createdAt ? new Date(createdAt).toISOString() : null,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null
  };
};

/**
 * GET /workspace/user?userId=1
 * List workspaces for a specific user (requires authentication)
 */
export const listWorkspaces = asyncHandler(async (req: any, res: Response) => {
  logger.debug('GET /api/workspace/user start');
  const { userId } = req.query;
  const authenticatedUserId = Number(req.user!.id);
  const requestedUserId = Number(userId);

  // Validate userId is provided and valid
  if (!userId || isNaN(requestedUserId)) {
    throw new BadRequestError('Valid userId query parameter is required');
  }

  // Users can only fetch their own workspaces (for now)
  // In the future, you might add admin privileges to fetch any user's workspaces
  if (authenticatedUserId !== requestedUserId) {
    throw new BadRequestError('You can only fetch your own workspaces');
  }

  const workspaces = await getUserWorkspaces(requestedUserId);
  console.log('Workspaces fetched for user', { userId: requestedUserId, workspaceCount: workspaces });
  const normalized = workspaces.map(normalizeWorkspace).filter((w): w is typeof normalizeWorkspace extends (...args: any[]) => infer R ? R & {} : never => w !== null);
  const hydrated = await ImageUrlService.hydrateArray(normalized as Record<string, any>[], ['logoUrl']);

  logger.debug('Workspaces retrieved for user', { userId: requestedUserId, workspace: hydrated });
  return ok(res, { workspaces: hydrated });
});

/**
 * POST /workspace
 * Create a new workspace and add creator as OWNER
 */
export const createWorkspaceController = asyncHandler(async (req: any, res: Response) => {
  logger.debug('POST /api/workspace start');
  const userId = Number(req.user!.id);
  const { name, logoUrl } = req.body;

  if (!name || typeof name !== 'string' || !isValidName(name)) {
    throw new BadRequestError('Invalid workspace name');
  }

  if (logoUrl !== undefined && logoUrl !== null && typeof logoUrl !== 'string') {
    throw new BadRequestError('Invalid logoUrl');
  }

  const workspaceId = await createWorkspace({
    name: name.trim(),
    logoUrl: logoUrl ?? undefined,
    createdBy: userId
  });

  await addWorkspaceMember(workspaceId, userId, 'OWNER');

  const workspace = await getWorkspaceWithRole(workspaceId, userId);

  if (!workspace) {
    throw new InternalServerError('Failed to create workspace');
  }

  logger.debug('Workspace created via API', { workspaceId, userId });

  const normalized = normalizeWorkspace(workspace);
  const hydrated = normalized ? await ImageUrlService.hydrateObject(normalized, ['logoUrl']) : null;

  return ok(res, { workspace: hydrated }, { statusCode: 201 });
});

/**
 * GET /workspace/:workspaceId
 * Get a workspace by ID for authenticated member
 */
export const getWorkspaceById = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const workspaceId = Number(req.params.workspaceId);

  const workspace = await getWorkspaceWithRole(workspaceId, userId);

  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  }

  const normalized = normalizeWorkspace(workspace);
  const hydrated = normalized ? await ImageUrlService.hydrateObject(normalized, ['logoUrl']) : null;

  return ok(res, { workspace: hydrated });
});

/**
 * PUT /workspace/:workspaceId
 * Replace workspace details (name and logoUrl)
 */
export const updateWorkspace = asyncHandler(async (req: any, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);
  logger.debug('PUT /api/workspace/:workspaceId start', { workspaceId, userId: req.user!.id });
  
  const { name, logoUrl } = req.body;

  if (!name || typeof name !== 'string' || !isValidName(name)) {
    throw new BadRequestError('Invalid workspace name');
  }

  if (logoUrl !== undefined && logoUrl !== null && typeof logoUrl !== 'string') {
    throw new BadRequestError('Invalid logoUrl');
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      name: name.trim(),
      logoUrl: logoUrl ?? null
    }
  });

  const workspace = await getWorkspaceWithRole(workspaceId, Number(req.user!.id));

  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  } 

  logger.debug('Workspace updated via API', { workspaceId, userId: req.user!.id });

  const normalized = normalizeWorkspace(workspace);
  const hydrated = normalized ? await ImageUrlService.hydrateObject(normalized, ['logoUrl']) : null;

  console.log('Workspace updated', { workspaceId, userId: req.user!.id, workspace: hydrated });
  return ok(res, { workspace: hydrated });
});

/**
 * PATCH /workspace/:workspaceId
 * Update workspace details partially
 */
export const patchWorkspace = asyncHandler(async (req: any, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);
  logger.debug('PATCH /api/workspace/:workspaceId start', { workspaceId, userId: req.user!.id });
  
  const { name, logoUrl } = req.body;

  if (name === undefined && logoUrl === undefined) {
    throw new BadRequestError('No fields provided for update');
  }

  if (name !== undefined && (typeof name !== 'string' || !isValidName(name))) {
    throw new BadRequestError('Invalid workspace name');
  }

  if (logoUrl !== undefined && logoUrl !== null && typeof logoUrl !== 'string') {
    throw new BadRequestError('Invalid logoUrl');
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(logoUrl !== undefined ? { logoUrl } : {})
    }
  });

  const workspace = await getWorkspaceWithRole(workspaceId, Number(req.user!.id));

  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  }

    logger.debug('Workspace partially updated via API', { workspaceId, userId: req.user!.id });

  const normalized = normalizeWorkspace(workspace);
  const hydrated = normalized ? await ImageUrlService.hydrateObject(normalized, ['logoUrl']) : null;

  return ok(res, { workspace: hydrated });
});
