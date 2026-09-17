import { prisma } from '../db';
import { BadRequestError, ForbiddenError, InternalServerError, NotFoundError } from '../errors';
import { APP_ROLES } from './authorization/constants/role.constants';
import { ProjectRepository } from '../repositories/project.repository';
import ResourceIdService from './resource-id.service';
import { AuthorizationService } from './authorization/services/authorization.service';
import { PERMISSIONS } from './authorization/constants/permission.constants';
import logger from '../utils/logger';

const SUBDOMAIN_REGEX = /^[a-z0-9_-]+$/i;

const isPrivilegedWorkspaceRole = (roleKey: string) => {
  return (
    roleKey === APP_ROLES.WORKSPACE.WORKSPACE_OWNER ||
    roleKey === APP_ROLES.WORKSPACE.WORKSPACE_ADMIN
  );
};

const normalizeSubdomain = (subdomain: string) => subdomain.toLowerCase().trim();

export const ProjectService = {
  async assertProjectAccess(projectId: number, userId: number) {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new BadRequestError('Invalid projectId');
    }

    const project = await ProjectRepository.findProjectById(prisma, projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return project;
  },

  /**
   * Create a new project in a workspace
   */
  async createProject(
    workspaceId: number,
    data: { name: string; subdomain: string; description?: string; createdById: number; supportedLanguages?: string[] }
  ): Promise<number> {
    const { name, subdomain, description, createdById, supportedLanguages = ["en"] } = data;

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      throw new BadRequestError('workspaceId must be a positive number');
    }

    if (!Number.isInteger(createdById) || createdById <= 0) {
      throw new BadRequestError('createdById must be a positive number');
    }

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestError('Project name is required');
    }

    if (!subdomain || typeof subdomain !== 'string' || subdomain.trim().length === 0) {
      throw new BadRequestError('Subdomain is required');
    }

    // Validate subdomain format (alphanumeric, hyphens, underscores only)
    if (!SUBDOMAIN_REGEX.test(subdomain)) {
      throw new BadRequestError('Subdomain can only contain alphanumeric characters, hyphens, and underscores');
    }

    const workspaceMember = await ProjectRepository.findWorkspaceMemberWithRole(
      prisma,
      workspaceId,
      createdById
    );

    if (!workspaceMember) {
      throw new ForbiddenError('Workspace not found or you do not have access');
    }

    const normalizedSubdomain = normalizeSubdomain(subdomain);

    // Check if subdomain already exists globally
    const existingProject = await ProjectRepository.findProjectBySlug(prisma, normalizedSubdomain);

    if (existingProject) {
      throw new BadRequestError('Subdomain is already taken');
    }

    const projectOwnerRole = await ProjectRepository.findRoleByKey(
      prisma,
      APP_ROLES.PROJECT.PROJECT_OWNER
    );

    if (!projectOwnerRole) {
      throw new InternalServerError('Project owner role not found. Ensure roles are seeded.');
    }

    try {
      const project = await prisma.$transaction(async (tx) => {
        const createdProject = await ProjectRepository.createProject(tx, {
          resourceId: await ResourceIdService.generateUniqueProjectId(tx),
          workspaceId,
          createdById,
          name: name.trim(),
          slug: normalizedSubdomain,
          description: description?.trim() || null,
          supportedLanguages,
        });

        await ProjectRepository.createProjectMember(tx, {
          projectId: createdProject.id,
          workspaceMemberId: workspaceMember.id,
          roleId: projectOwnerRole.id,
        });

        // Generate default environments
        await tx.environment.createMany({
          data: [
            { projectId: createdProject.id, name: 'development' },
            { projectId: createdProject.id, name: 'staging' },
            { projectId: createdProject.id, name: 'production' }
          ]
        });

        return createdProject;
      });

      return project.id as unknown as number;
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Unique constraint violation
        throw new BadRequestError('Subdomain is already taken or project name already exists in this workspace');
      }
      throw err;
    }
  },

  /**
   * Get a project by ID
   */
  async getProjectById(projectId: number): Promise<any> {
    const project = await ProjectRepository.findProjectById(prisma, projectId);

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return project;
  },

  /**
   * List all projects in a workspace
   */
  async listProjectsByWorkspace(workspaceId: number, userId: number): Promise<any[]> {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      throw new BadRequestError('workspaceId must be a positive number');
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestError('userId must be a positive number');
    }

    // Verify workspace access
    const hasWorkspaceAccess = await AuthorizationService.can(
      userId.toString(),
      PERMISSIONS.WORKSPACE.READ,
      'workspace',
      workspaceId.toString()
    );

    if (!hasWorkspaceAccess) {
      throw new ForbiddenError('Not a workspace member or insufficient permissions');
    }

    // 1. Ask Authorization Engine for ALL projects where user has PROJECT.READ
    const readableProjectIds = await AuthorizationService.getScopeIdsWithPermission(
      userId.toString(),
      'project',
      PERMISSIONS.PROJECT.READ
    );

    if (readableProjectIds.length === 0) {
      return [];
    }

    // 2. Fetch those projects, scoped to the requested workspace
    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        id: { in: readableProjectIds.map(Number) }
      },
      orderBy: { createdAt: 'desc' }
    });

    return projects;
  },

  /**
   * Update a project
   */
  async updateProject(
    projectId: number,
    userId: number,
    data: { name?: string; subdomain?: string; description?: string }
  ): Promise<any> {
    const existingProject = await this.assertProjectAccess(projectId, userId);

    // If subdomain is being changed, check if new one is available
    if (data.subdomain && data.subdomain !== existingProject.slug) {
      const normalizedNewSubdomain = normalizeSubdomain(data.subdomain);

      if (!SUBDOMAIN_REGEX.test(normalizedNewSubdomain)) {
        throw new BadRequestError('Subdomain can only contain alphanumeric characters, hyphens, and underscores');
      }

      const conflictingProject = await ProjectRepository.findProjectBySlug(prisma, normalizedNewSubdomain);

      if (conflictingProject && conflictingProject.id !== existingProject.id) {
        throw new BadRequestError('Subdomain is already taken');
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (trimmedName.length === 0) {
        throw new BadRequestError('Project name cannot be empty');
      }
      updateData.name = trimmedName;
    }
    if (data.subdomain !== undefined) {
      updateData.slug = normalizeSubdomain(data.subdomain);
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    const project = await ProjectRepository.updateProject(prisma, projectId, updateData);

    return project;
  },

  /**
   * Delete a project
   */
  async deleteProject(projectId: number, userId: number): Promise<void> {
    const project = await this.assertProjectAccess(projectId, userId);
    
    const projectWithFeeds = await prisma.project.findUnique({
      where: { id: projectId },
      include: { feeds: { select: { id: true } } }
    });
    
    const feedIds = projectWithFeeds?.feeds.map(f => f.id) || [];

    await ProjectRepository.deleteProject(prisma, projectId);

    const { enqueueCleanupJob } = require('./cleanup/infrastructure/queue/cleanup.queue');
    await enqueueCleanupJob({
      type: 'project',
      projectId,
      feedIds,
      projectResourceId: project.resourceId
    });
  },

  /**
   * Check if a subdomain is available
   */
  async isSubdomainAvailable(subdomain: string): Promise<boolean> {
    if (!subdomain || typeof subdomain !== 'string' || subdomain.trim().length === 0) {
      return false;
    }

    const normalizedSubdomain = normalizeSubdomain(subdomain);

    if (!SUBDOMAIN_REGEX.test(normalizedSubdomain)) {
      return false;
    }

    const existingProject = await ProjectRepository.findProjectBySlug(prisma, normalizedSubdomain);

    return !existingProject;
  },

  /**
   * Get a project by subdomain (public lookup)
   */
  async getProjectBySubdomain(subdomain: string): Promise<any> {
    const project = await ProjectRepository.findProjectBySlug(prisma, normalizeSubdomain(subdomain));

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return project;
  },

  /**
   * Update the supported languages for a project
   */
  async updateProjectLanguages(
    projectId: number,
    userId: number,
    supportedLanguages: string[]
  ): Promise<any> {
    await this.assertProjectAccess(projectId, userId);

    if (!Array.isArray(supportedLanguages) || supportedLanguages.length === 0) {
      throw new BadRequestError('supportedLanguages must be a non-empty array of language codes');
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: { supportedLanguages },
    });

    return project;
  }

  , async getProjectMembers(projectId: number) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');

    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        role: true,
        workspaceMember: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, resourceId: true } }
          }
        }
      }
    });

    const explicitMemberIds = projectMembers.map(pm => pm.workspaceMember.id);

    const privilegedWorkspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        ...(explicitMemberIds.length > 0 ? { id: { notIn: explicitMemberIds } } : {}),
        role: {
          key: {
            in: ['WORKSPACE_OWNER', 'WORKSPACE_ADMIN']
          }
        }
      },
      include: {
        role: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true, resourceId: true } }
      }
    });

    const results = projectMembers.map(pm => ({
      projectMemberId: pm.id,
      role: pm.role.name,
      roleKey: pm.role.key,
      joinedAt: pm.joinedAt,
      user: pm.workspaceMember.user
    }));

    const privilegedResults = privilegedWorkspaceMembers.map(wm => ({
      projectMemberId: null,
      role: wm.role.name,
      roleKey: wm.role.key,
      joinedAt: wm.joinedAt,
      user: wm.user
    }));

    return [...results, ...privilegedResults];
  }

  , async searchProjectMembers(projectId: number, query: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Project not found');

    const projectMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        workspaceMember: {
          user: {
            OR: [
              { firstName: { contains: query } },
              { lastName: { contains: query } },
              { email: { contains: query } }
            ]
          }
        }
      },
      include: {
        workspaceMember: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, resourceId: true } }
          }
        }
      },
      take: 10
    });

    const explicitMemberIds = new Set(projectMembers.map(pm => pm.workspaceMember.id));

    const privilegedWorkspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        ...(explicitMemberIds.size > 0 ? { id: { notIn: Array.from(explicitMemberIds) } } : {}),
        role: {
          key: {
            in: [APP_ROLES.WORKSPACE.WORKSPACE_OWNER, APP_ROLES.WORKSPACE.WORKSPACE_ADMIN]
          }
        },
        user: {
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { email: { contains: query } }
          ]
        }
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, resourceId: true } }
      },
      take: 10
    });

    const explicitUsers = projectMembers.map(pm => pm.workspaceMember.user);
    const privilegedUsers = privilegedWorkspaceMembers.map(wm => wm.user);

    // Limit to 10 total results
    return [...explicitUsers, ...privilegedUsers].slice(0, 10);
  }
};