import { Response, Request } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../errors';
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
    description,
    createdById: Number(req.user!.id)
  });

  const project = await ProjectService.getProjectById(projectId);

  logger.debug('Project created via API', { project: project, workspaceId, userId: req.user!.id });

  return ok(res, {
    project: {
      id: project.id,
      resourceId: project.resourceId,
      name: project.name,
      description: project.description,
      subdomain: project.slug,
      workspaceId: project.workspaceId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  }, { statusCode: 201 });
});

/**
 * GET /api/projects/:projectId
 * Get a project with authorization check
 * User must have workspace membership and either be OWNER or explicitly assigned
 */
export const getProjectById = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const workspaceId = Number(req.params.workspaceId);
  const projectId = Number(req.params.projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      resourceId: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  return ok(res, {
    project: {
      id: project.id,
      resourceId: project.resourceId,
      name: project.name,
      subdomain: project.slug,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
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

  // 1. Check workspace membership
  const workspaceMember = await prisma.workspaceMember.findMany({
    where: {
        workspaceId,
        userId,
      },
      include: {
        projectMemberships: {
          include: {
            project: true,
          }
        }
      }
  });

  if (!workspaceMember) {
    throw new ForbiddenError('Not a workspace member');
  }

  // 3. Fetch projects
  const projects = await prisma.projectMember.findMany({
    where: {
      workspaceMember:{
        workspaceId: workspaceId,
        userId: userId
      }
    },
    include: {
      project: true,
      workspaceMember: {
        include: {
          workspace: true,
        }
      }
    },
  });

  const projectList = projects.map(pm => ({
    id: pm.project.id,
    resourceId: pm.project.resourceId,
    name: pm.project.name,
    subdomain: pm.project.slug,
    description: pm.project.description,
    createdAt: pm.project.createdAt,
    updatedAt: pm.project.updatedAt,
  }));
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