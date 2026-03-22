/**
 * Get all projects in a workspace visible to the current user
 * Authorization: OWNER sees all, ADMIN/USER see only assigned
 *
 * GET /api/workspaces/:workspaceId/projects
 */

import { Request, Response } from 'express';
import { prisma } from '../../db/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { authorizationService } from '../../services/authorization.service';
import { ForbiddenError, NotFoundError } from '../../errors';

export const getWorkspaceProjects = asyncHandler(async (req: Request, res: Response) => {
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

  // 2. Get visible project IDs based on authorization
  // - OWNER sees all projects
  // - ADMIN/USER see only explicitly assigned projects
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
 * Get a single project with authorization check
 * User must have workspace membership and either be OWNER or explicitly assigned
 *
 * GET /api/workspaces/:workspaceId/projects/:projectId
 */
export const getProject = asyncHandler(async (req: Request, res: Response) => {
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
 * Get all members assigned to a project
 * Requires workspace membership; returns all project members with their roles
 *
 * GET /api/workspaces/:workspaceId/projects/:projectId/members
 */
export const getProjectMembers = asyncHandler(async (req: Request, res: Response) => {
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
