import { Response, Request } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../errors';
import { ProjectService } from '../../services/project.service';
import { authorizationService } from '../../services/authorization.service';
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
 * GET /api/projects/:projectId
 * Get a project with authorization check
 * User must have workspace membership and either be OWNER or explicitly assigned
 */
export const getProjectById = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const workspaceId = Number(req.params.workspaceId);
  const projectId = Number(req.params.projectId);

  // 1. Check workspace membership
  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: {
      uk_workspace_user: {
        workspaceId,
        userId,
      },
    },
  });

  if (!workspaceMember) {
    throw new ForbiddenError('Not a workspace member');
  }

  // 2. Get visible project IDs
  const visibleProjectIds = await authorizationService.getVisibleProjectIds(
    userId,
    workspaceId
  );

  // 3. Check if user can access this specific project
  if (!visibleProjectIds.includes(projectId)) {
    throw new ForbiddenError('Not authorized to view this project');
  }

  // 4. Fetch project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!project) {
    throw new NotFoundError('Project not found');
  }

  return ok(res, { project });
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
  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: {
      uk_workspace_user: {
        workspaceId,
        userId,
      },
    },
  });

  if (!workspaceMember) {
    throw new ForbiddenError('Not a workspace member');
  }

  // 2. Get visible project IDs based on authorization
  // - OWNER sees all projects
  // - ADMIN sees all projects
  // - USER sees only explicitly assigned projects
  const visibleProjectIds = await authorizationService.getVisibleProjectIds(
    userId,
    workspaceId
  );

  // 3. Fetch projects
  const projects = await prisma.project.findMany({
    where: {
      workspaceId,
      id: {
        in: visibleProjectIds,
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return ok(res, {
    projects,
    total: projects.length,
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

/**
 * GET /api/projects/:projectId/members
 * Get all members assigned to a project with their roles
 * Requires workspace membership
 */
export const getProjectMembers = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const workspaceId = Number(req.params.workspaceId);
  const projectId = Number(req.params.projectId);

  // 1. Check workspace membership
  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: {
      uk_workspace_user: {
        workspaceId,
        userId,
      },
    },
  });

  if (!workspaceMember) {
    throw new ForbiddenError('Not a workspace member');
  }

  // 2. Verify project exists in workspace
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true },
  });

  if (!project || project.workspaceId !== workspaceId) {
    throw new NotFoundError('Project not found');
  }

  // 3. Get all project members with their roles
  const projectMembers = await prisma.projectMember.findMany({
    where: {
      projectId,
      isActive: true,
    },
    select: {
      id: true,
      userId: true,
      assignedAt: true,
      projectMemberRoles: {
        select: {
          role: true,
        },
      },
    },
  });

  const members = projectMembers.map((m: any) => ({
    userId: m.userId.toString(),
    assignedAt: m.assignedAt,
    roles: m.projectMemberRoles.map((pmr: any) => pmr.role),
  }));

  return ok(res, { members, total: members.length });
});