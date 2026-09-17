import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError } from '../../errors';
import { ProjectService } from '../../services/project.service';
import logger from '../../utils/logger';
import { WorkspaceInviteService } from '../../services/workspace/workspace-invite.service';
import { APP_ROLES } from '../../services/authorization/constants/role.constants';


const serializeProject = (project: any, authNode?: any) => ({
  id: project.id,
  resourceId: project.resourceId,
  name: project.name,
  subdomain: project.slug,
  description: project.description,
  workspaceId: project.workspaceId,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  ...(authNode ? { 
    permissions: authNode.permissions || [],
    roles: authNode.roles || []
  } : {})
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

import { AuthorizationService } from '../../services/authorization/services/authorization.service';

/**
 * GET /api/projects/:projectId
 * Get a project with authorization check
 * User must have workspace membership and either be OWNER or explicitly assigned
 */
export const getProjectById = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const projectId = Number(req.params.projectId);

  const project = await ProjectService.assertProjectAccess(projectId, userId);
  const authNode = await AuthorizationService.getNode(userId.toString(), 'project', projectId.toString());

  return ok(res, {
    project: serializeProject(project, authNode),
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
  
  const projectList = await Promise.all(projects.map(async (project) => {
    const authNode = await AuthorizationService.getNode(userId.toString(), 'project', project.id.toString());
    return serializeProject(project, authNode);
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


export const inviteToProject = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const { email, roleId } = req.body;
  const inviterId = Number(req.user!.id);
  const workspaceId = Number(req.workspace!.id);

  if (!email) {
    throw new BadRequestError('Email is required');
  }
  if (!roleId) {
    throw new BadRequestError('roleId is required');
  }

  // Get WORKSPACE_GUEST role
  // We can hardcode or query it. But we don't have RoleService imported. Let's just pass APP_ROLES.WORKSPACE.WORKSPACE_GUEST.
  // Wait, sendInvite takes workspaceRoleId as number. We need to look it up.
  const { prisma } = require('../../db');
  const guestRole = await prisma.role.findUnique({
    where: { key: APP_ROLES.WORKSPACE.WORKSPACE_GUEST }
  });

  const projectRole = await prisma.role.findUnique({
    where: { key: typeof roleId === 'string' ? roleId : 'PROJECT_EDITOR' } // Fallback just in case
  });

  if (!projectRole || projectRole.scope !== 'PROJECT') {
    throw new BadRequestError('Invalid project role');
  }

  if (projectRole.key === 'PROJECT_OWNER') {
    throw new BadRequestError('PROJECT_OWNER cannot be assigned via invitation');
  }

  // Prevent PROJECT_ADMIN from assigning another PROJECT_ADMIN
  // We can enforce this by checking if the user has workspace-level admin or project-level owner access, 
  // but to keep it simple and robust, let's just reject PROJECT_ADMIN for now if requested by the spec
  // actually, let's just check if they are trying to assign PROJECT_ADMIN and block it unless we check their role.
  if (projectRole.key === 'PROJECT_ADMIN') {
    // Only allow if inviter is WORKSPACE_OWNER, WORKSPACE_ADMIN, or PROJECT_OWNER
    const { AuthorizationService } = require('../../services/authorization/services/authorization.service');
    const isProjectOwner = await AuthorizationService.hasRole(inviterId.toString(), 'project', projectId.toString(), 'PROJECT_OWNER');
    const isWorkspaceAdmin = await AuthorizationService.hasRole(inviterId.toString(), 'workspace', workspaceId.toString(), 'WORKSPACE_ADMIN');
    const isWorkspaceOwner = await AuthorizationService.hasRole(inviterId.toString(), 'workspace', workspaceId.toString(), 'WORKSPACE_OWNER');
    
    if (!isProjectOwner && !isWorkspaceAdmin && !isWorkspaceOwner) {
      throw new BadRequestError('Only Owners can assign the Admin role');
    }
  }

  if (!guestRole) {
    throw new BadRequestError('Guest role not found');
  }

  // The inviterName can be fetched from req.user but req.user usually just has id. Let's lookup inviter.
  const inviter = await prisma.user.findUnique({ where: { id: inviterId } });

  const invitation = await WorkspaceInviteService.sendInvite(
    workspaceId,
    inviterId,
    inviter?.firstName || 'A team member',
    {
      email,
      workspaceRoleId: guestRole.id,
      projectAssignments: [{ projectId, roleId: projectRole.id }]
    }
  );

  return ok(res, { invitation, message: 'Invitation sent successfully' });
});


export const searchInvitableUsers = asyncHandler(async (req: any, res: Response) => {
  const projectId = Number(req.params.projectId);
  const workspaceId = Number(req.workspace!.id);
  const q = (req.query.q as string || '').trim();
  
  const { prisma } = require('../../db');
  
  // Find project members to exclude them
  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId },
    select: { workspaceMemberId: true }
  });
  
  const excludedIds = projectMembers.map((pm: any) => pm.workspaceMemberId);
  
  const invitableMembers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      id: { notIn: excludedIds },
      ...(q ? {
        user: {
          OR: [
            { email: { contains: q } },
            { firstName: { contains: q } },
            { lastName: { contains: q } }
          ]
        }
      } : {})
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      role: { select: { name: true } }
    },
    take: 10
  });

  return ok(res, { users: invitableMembers });
});
