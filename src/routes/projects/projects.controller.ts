import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError } from '../../errors';
import { ProjectService } from '../../services/project.service';
import logger from '../../utils/logger';

const serializeProject = (project: any) => ({
  id: project.id,
  resourceId: project.resourceId,
  name: project.name,
  subdomain: project.slug,
  description: project.description,
  workspaceId: project.workspaceId,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

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

  const projectId = await ProjectService.createProject(workspaceId, {
    name,
    subdomain,
    description,
    createdById: Number(req.user!.id)
  });

  const project = await ProjectService.getProjectById(projectId);

  logger.debug('Project created via API', { project: project, workspaceId, userId: req.user!.id });

  return ok(res, {
    project: serializeProject(project),
  }, { statusCode: 201 });
});

/**
 * GET /api/projects/:projectId
 * Get a project with authorization check
 * User must have workspace membership and either be OWNER or explicitly assigned
 */
export const getProjectById = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const projectId = Number(req.params.projectId);

  const project = await ProjectService.assertProjectAccess(projectId, userId);

  return ok(res, {
    project: serializeProject(project),
  });
});

/**
 * GET /api/workspaces/:workspaceId/projects
 * List all projects in a workspace visible to the current user
 * Authorization: OWNER sees all, ADMIN see all, USER sees only assigned
 */
export const listProjectsByWorkspace = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const workspaceId = Number(req.params.workspaceId);

  const projects = await ProjectService.listProjectsByWorkspace(workspaceId, userId);
  const projectList = projects.map(serializeProject);

  return ok(res, {
    projects: projectList,
    total: projectList.length,
    workspaceId: workspaceId.toString(),
  });
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

  if (!name || typeof name !== 'string') {
    throw new BadRequestError('name is required');
  }

  if (!subdomain || typeof subdomain !== 'string') {
    throw new BadRequestError('subdomain is required');
  }

  const project = await ProjectService.updateProject(projectId, userId, {
    name,
    subdomain,
    description
  });

  logger.debug('Project updated via API', { projectId, userId });

  return ok(res, { project: serializeProject(project) });
});

/**
 * PATCH /projects/:projectId
 * Partially update a project
 */
export const patchProject = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  logger.debug('PATCH /api/projects/:projectId start', { projectId, userId: req.user!.id });
  
  const userId = Number(req.user!.id);

  const { name, subdomain, description } = req.body;

  if (name === undefined && subdomain === undefined && description === undefined) {
    throw new BadRequestError('No fields provided for update');
  }

  const updated = await ProjectService.updateProject(projectId, userId, {
    name,
    subdomain,
    description
  });

  logger.debug('Project patched via API', { projectId, userId });

  return ok(res, { project: serializeProject(updated) });
});

/**
 * DELETE /projects/:projectId
 * Delete a project
 */
export const deleteProject = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  logger.debug('DELETE /api/projects/:projectId start', { projectId, userId: req.user!.id });
  
  const userId = Number(req.user!.id);

  await ProjectService.deleteProject(projectId, userId);

  logger.debug('Project deleted via API', { projectId, userId });

  return ok(res, { message: 'Project deleted successfully' });
});

/**
 * GET /projects/:projectId/languages
 * Get the supported languages for a project
 */
export const getProjectLanguages = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const userId = Number(req.user!.id);

  const project = await ProjectService.assertProjectAccess(projectId, userId);

  return ok(res, {
    supportedLanguages: project.supportedLanguages || ["en"]
  });
});

/**
 * PUT /projects/:projectId/languages
 * Update the supported languages for a project
 */
export const updateProjectLanguages = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const userId = Number(req.user!.id);
  const { supportedLanguages } = req.body;

  if (!Array.isArray(supportedLanguages)) {
    throw new BadRequestError('supportedLanguages must be an array of language codes');
  }

  const updatedProject = await ProjectService.updateProjectLanguages(projectId, userId, supportedLanguages);

  return ok(res, {
    supportedLanguages: updatedProject.supportedLanguages,
    message: 'Project languages updated successfully'
  });
});
export const getProjectMembers = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  
  // Assuming ProjectService handles authorization check inside
  const members = await ProjectService.getProjectMembers(projectId);

  return ok(res, {
    members,
    message: 'Project members retrieved successfully'
  });
});

export const searchProjectMembers = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const q = req.query.q as string || '';

  const users = await ProjectService.searchProjectMembers(projectId, q);
  return ok(res, users);
});
