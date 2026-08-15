import { prisma } from '../db';
import { BadRequestError, ForbiddenError, InternalServerError, NotFoundError } from '../errors';
import { APP_ROLES } from './authorization/constants/role.constants';
import { ProjectRepository } from '../repositories/project.repository';
import ResourceIdService from './resource-id.service';

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

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestError('Invalid userId');
    }

    const project = await ProjectRepository.findProjectById(prisma, projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const workspaceMember = await ProjectRepository.findWorkspaceMemberWithRoleAndProjectMembership(
      prisma,
      project.workspaceId,
      userId,
      projectId
    );

    if (!workspaceMember) {
      throw new ForbiddenError('You do not have access to this project');
    }

    const hasPrivilegedRole = isPrivilegedWorkspaceRole(workspaceMember.role.key);
    const isProjectMember = workspaceMember.projectMemberships.length > 0;

    if (!hasPrivilegedRole && !isProjectMember) {
      throw new ForbiddenError('You do not have access to this project');
    }

    return project;
  },

  /**
   * Create a new project in a workspace
   */
  async createProject(
    workspaceId: number,
    data: { name: string; subdomain: string; description?: string; createdById: number }
  ): Promise<number> {
    const { name, subdomain, description, createdById } = data;

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
        });

        await ProjectRepository.createProjectMember(tx, {
          projectId: createdProject.id,
          workspaceMemberId: workspaceMember.id,
          roleId: projectOwnerRole.id,
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

    const workspaceMember = await ProjectRepository.findWorkspaceMemberWithRole(prisma, workspaceId, userId);

    if (!workspaceMember) {
      throw new ForbiddenError('Not a workspace member');
    }

    const hasPrivilegedRole = isPrivilegedWorkspaceRole(workspaceMember.role.key);

    if (hasPrivilegedRole) {
      return ProjectRepository.listWorkspaceProjects(prisma, workspaceId);
    }

    const memberships = await ProjectRepository.listProjectsByWorkspaceMember(
      prisma,
      workspaceMember.id,
      workspaceId
    );

    const projects = memberships.map((membership) => membership.project);

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
    await this.assertProjectAccess(projectId, userId);
    await ProjectRepository.deleteProject(prisma, projectId);
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
  }
};

export default ProjectService;
