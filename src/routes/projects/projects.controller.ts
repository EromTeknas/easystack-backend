import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError, NotFoundError } from '../../errors';
import { ProjectService } from '../../services/project.service';
import { prisma } from '../../db';
import logger from '../../utils/logger';

/**
 * POST /projects
 * Create a new project in a workspace
 */
export const createProject = asyncHandler(async (req: any, res: Response) => {
  logger.debug('POST /api/projects start', { userId: req.user!.id });
  const { workspaceId, name, subdomain, description } = req.body;

  if (!workspaceId || typeof workspaceId !== 'number') {
    throw new BadRequestError('workspaceId is required and must be a number');
  }

  if (!name || typeof name !== 'string') {
    throw new BadRequestError('name is required');
  }

  if (!subdomain || typeof subdomain !== 'string') {
    throw new BadRequestError('subdomain is required');
  }

  // Verify workspace exists and user has access
  const workspace = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: Number(req.user!.id)
    }
  });

  if (!workspace) {
    throw new BadRequestError('Workspace not found or you do not have access');
  }

  const projectId = await ProjectService.createProject(workspaceId, {
    name,
    subdomain,
    description
  });

  const project = await ProjectService.getProjectById(projectId);

  logger.debug('Project created via API', { project: project, workspaceId, userId: req.user!.id });

  return ok(res, { projectId: project!.id, }, { statusCode: 201 });
});

/**
 * GET /projects/:projectId
 * Get a project by ID
 */
export const getProjectById = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const userId = Number(req.user!.id);

  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Verify user has access to this project's workspace
  const workspace = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: project.workspaceId,
      userId
    }
  });

  if (!workspace) {
    throw new BadRequestError('You do not have access to this project');
  }

  return ok(res, { project });
});

/**
 * GET /workspaces/:workspaceId/projects
 * List all projects in a workspace
 */
export const listProjectsByWorkspace = asyncHandler(async (req: any, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);
  const userId = Number(req.user!.id);

  // Verify user has access to this workspace
  const workspace = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId
    }
  });

  if (!workspace) {
    throw new BadRequestError('Workspace not found or you do not have access');
  }

  const projects = await ProjectService.listProjectsByWorkspace(workspaceId);

  logger.debug('Projects listed for workspace', { workspaceId, projectCount: projects.length });

  return ok(res, { projects });
});

/**
 * PUT /projects/:projectId
 * Update a project (full replacement)
 */
export const updateProject = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  logger.debug('PUT /api/projects/:projectId start', { projectId, userId: req.user!.id });
  
  const { name, subdomain, description } = req.body;
  const userId = Number(req.user!.id);

  // Get project and verify access
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const workspace = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: project.workspaceId,
      userId
    }
  });

  if (!workspace) {
    throw new BadRequestError('You do not have access to this project');
  }

  if (!name || typeof name !== 'string') {
    throw new BadRequestError('name is required');
  }

  if (!subdomain || typeof subdomain !== 'string') {
    throw new BadRequestError('subdomain is required');
  }

  const updated = await ProjectService.updateProject(projectId, {
    name,
    subdomain,
    description
  });

  logger.debug('Project updated via API', { projectId, userId });

  return ok(res, { project: updated });
});

/**
 * PATCH /projects/:projectId
 * Partially update a project
 */
export const patchProject = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  logger.debug('PATCH /api/projects/:projectId start', { projectId, userId: req.user!.id });
  
  const userId = Number(req.user!.id);

  // Get project and verify access
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const workspace = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: project.workspaceId,
      userId
    }
  });

  if (!workspace) {
    throw new BadRequestError('You do not have access to this project');
  }

  const { name, subdomain, description } = req.body;

  if (name === undefined && subdomain === undefined && description === undefined) {
    throw new BadRequestError('No fields provided for update');
  }

  const updated = await ProjectService.updateProject(projectId, {
    name,
    subdomain,
    description
  });

  logger.debug('Project patched via API', { projectId, userId });

  return ok(res, { project: updated });
});

/**
 * DELETE /projects/:projectId
 * Delete a project
 */
export const deleteProject = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  logger.debug('DELETE /api/projects/:projectId start', { projectId, userId: req.user!.id });
  
  const userId = Number(req.user!.id);

  // Get project and verify access
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  const workspace = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: project.workspaceId,
      userId
    }
  });

  if (!workspace) {
    throw new BadRequestError('You do not have access to this project');
  }

  await ProjectService.deleteProject(projectId);

  logger.debug('Project deleted via API', { projectId, userId });

  return ok(res, { message: 'Project deleted successfully' });
});

/**
 * GET /projects/subdomain-available/:subdomain
 * Check if a subdomain is available
 */
export const checkSubdomainAvailability = asyncHandler(async (req: any, res: Response) => {
  const { subdomain } = req.params;

  if (!subdomain || typeof subdomain !== 'string') {
    throw new BadRequestError('subdomain is required');
  }

  const isAvailable = await ProjectService.isSubdomainAvailable(subdomain);

  return ok(res, {
    subdomain,
    available: isAvailable,
    message: isAvailable ? 'Subdomain is available' : 'Subdomain is not available'
  });
});

/**
 * GET /projects/by-subdomain/:subdomain (PUBLIC)
 * Get a project by subdomain (public lookup, no auth required)
 */
export const getProjectBySubdomain = asyncHandler(async (req: any, res: Response) => {
  const { subdomain } = req.params;

  if (!subdomain || typeof subdomain !== 'string') {
    throw new BadRequestError('subdomain is required');
  }

  const project = await prisma.project.findUnique({
    where: { subdomain: subdomain.toLowerCase().trim() }
  });

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  // Optionally hide sensitive data for public access
  const publicProject = {
    id: project.id,
    name: project.name,
    subdomain: project.subdomain,
    description: project.description,
    workspaceId: project.workspaceId,
    createdAt: project.createdAt
  };

  return ok(res, { project: publicProject });
});
