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
import { isValidName } from '../../utils/validation';
import { prisma } from '../../db';
import logger from '../../utils/logger';

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
 * GET /workspace
 * List workspaces for authenticated user
 */
export const listWorkspaces = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);

  const workspaces = await getUserWorkspaces(userId);
  const normalized = workspaces.map(normalizeWorkspace);

  return ok(res, { workspaces: normalized });
});

/**
 * POST /workspace
 * Create a new workspace and add creator as OWNER
 */
export const createWorkspaceController = asyncHandler(async (req: any, res: Response) => {
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

  logger.info('Workspace created via API', { workspaceId, userId });

  return ok(res, { workspace: normalizeWorkspace(workspace) }, { statusCode: 201 });
});

/**
 * GET /workspace/:workspaceId
 * Get a workspace by ID for authenticated member
 */
export const getWorkspaceById = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const { workspaceId } = req.params;

  const workspace = await getWorkspaceWithRole(workspaceId, userId);

  if (!workspace) {
    throw new NotFoundError('Workspace not found');
  }

  return ok(res, { workspace: normalizeWorkspace(workspace) });
});

/**
 * PUT /workspace/:workspaceId
 * Replace workspace details (name and logoUrl)
 */
export const updateWorkspace = asyncHandler(async (req: any, res: Response) => {
  const { workspaceId } = req.params;
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

  return ok(res, { workspace: normalizeWorkspace(workspace) });
});

/**
 * PATCH /workspace/:workspaceId
 * Update workspace details partially
 */
export const patchWorkspace = asyncHandler(async (req: any, res: Response) => {
  const { workspaceId } = req.params;
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

  return ok(res, { workspace: normalizeWorkspace(workspace) });
});
