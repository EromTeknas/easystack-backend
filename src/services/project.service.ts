import { prisma } from '../db';
import { BadRequestError, NotFoundError } from '../errors';
import logger from '../utils/logger';

export const ProjectService = {
  /**
   * Create a new project in a workspace (transactional)
   * Validates all data before creating and rolls back if any validation fails
   */
  async createProjectWithValidation(
    workspaceId: number,
    data: { name: string; subdomain: string; description?: string },
    options?: { validateWorkspaceAccess?: boolean; userId?: number }
  ): Promise<number> {
    const { name, subdomain, description } = data;

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestError('Project name is required');
    }

    if (!subdomain || typeof subdomain !== 'string' || subdomain.trim().length === 0) {
      throw new BadRequestError('Subdomain is required');
    }

    const subdomainRegex = /^[a-z0-9_-]+$/i;
    if (!subdomainRegex.test(subdomain)) {
      throw new BadRequestError('Subdomain can only contain alphanumeric characters, hyphens, and underscores');
    }

    try {
      const projectId = await prisma.$transaction(async (tx) => {
        // Step 1: Verify workspace exists (if userId provided, verify user has access)
        if (options?.validateWorkspaceAccess && options?.userId) {
          const member = await tx.workspaceMember.findFirst({
            where: {
              workspaceId,
              userId: options.userId,
            },
          });

          if (!member) {
            throw new BadRequestError('You do not have access to this workspace');
          }

          logger.info('Workspace access verified in transaction', {
            workspaceId,
            userId: options.userId,
          });
        } else {
          const workspace = await tx.workspace.findUnique({
            where: { id: workspaceId },
          });

          if (!workspace) {
            throw new BadRequestError('Workspace not found');
          }
        }

        // Step 2: Check if subdomain already exists globally
        const existingProject = await tx.project.findUnique({
          where: { subdomain: subdomain.toLowerCase().trim() },
        });

        if (existingProject) {
          throw new BadRequestError('Subdomain is already taken');
        }

        logger.info('Subdomain availability verified in transaction', {
          workspaceId,
          subdomain,
        });

        // Step 3: Create project
        const project = await tx.project.create({
          data: {
            workspaceId,
            name: name.trim(),
            subdomain: subdomain.toLowerCase().trim(),
            description: description?.trim() || null,
          },
        });

        logger.info('Project created in transaction', {
          projectId: project.id,
          workspaceId,
          subdomain: project.subdomain,
        });

        return project.id as unknown as number;
      });

      return projectId;
    } catch (err: any) {
      logger.error('Failed to create project with validation (transaction rolled back):', err);
      throw err;
    }
  },

  /**
   * Create a new project in a workspace
   */
  async createProject(
    workspaceId: number,
    data: { name: string; subdomain: string; description?: string }
  ): Promise<number> {
    const { name, subdomain, description } = data;

    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestError('Project name is required');
    }

    if (!subdomain || typeof subdomain !== 'string' || subdomain.trim().length === 0) {
      throw new BadRequestError('Subdomain is required');
    }

    // Validate subdomain format (alphanumeric, hyphens, underscores only)
    const subdomainRegex = /^[a-z0-9_-]+$/i;
    if (!subdomainRegex.test(subdomain)) {
      throw new BadRequestError('Subdomain can only contain alphanumeric characters, hyphens, and underscores');
    }

    // Check if subdomain already exists globally
    const existingProject = await prisma.project.findUnique({
      where: { subdomain }
    });

    if (existingProject) {
      throw new BadRequestError('Subdomain is already taken');
    }

    try {
      const project = await prisma.project.create({
        data: {
          workspaceId,
          name: name.trim(),
          subdomain: subdomain.toLowerCase().trim(),
          description: description?.trim() || null
        } as any  // Type assertion since id is auto-generated
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
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: true
      }
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return project;
  },

  /**
   * List all projects in a workspace
   */
  async listProjectsByWorkspace(workspaceId: number): Promise<any[]> {
    const projects = await prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    });

    return projects;
  },

  /**
   * Update a project
   */
  async updateProject(
    projectId: number,
    data: { name?: string; subdomain?: string; description?: string }
  ): Promise<any> {
    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!existingProject) {
      throw new NotFoundError('Project not found');
    }

    // If subdomain is being changed, check if new one is available
    if (data.subdomain && data.subdomain !== existingProject.subdomain) {
      const normalizedNewSubdomain = data.subdomain.toLowerCase().trim();

      const subdomainRegex = /^[a-z0-9_-]+$/i;
      if (!subdomainRegex.test(normalizedNewSubdomain)) {
        throw new BadRequestError('Subdomain can only contain alphanumeric characters, hyphens, and underscores');
      }

      const conflictingProject = await prisma.project.findUnique({
        where: { subdomain: normalizedNewSubdomain }
      });

      if (conflictingProject) {
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
      updateData.subdomain = data.subdomain.toLowerCase().trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: updateData
    });

    return project;
  },

  /**
   * Delete a project
   */
  async deleteProject(projectId: number): Promise<void> {
    await prisma.project.delete({
      where: { id: projectId }
    });
  },

  /**
   * Check if a subdomain is available
   */
  async isSubdomainAvailable(subdomain: string): Promise<boolean> {
    if (!subdomain || typeof subdomain !== 'string' || subdomain.trim().length === 0) {
      return false;
    }

    const normalizedSubdomain = subdomain.toLowerCase().trim();

    const subdomainRegex = /^[a-z0-9_-]+$/i;
    if (!subdomainRegex.test(normalizedSubdomain)) {
      return false;
    }

    const existingProject = await prisma.project.findUnique({
      where: { subdomain: normalizedSubdomain }
    });

    return !existingProject;
  },

  /**
   * Get a project by subdomain (public lookup)
   */
  async getProjectBySubdomain(subdomain: string): Promise<any> {
    const project = await prisma.project.findUnique({
      where: { subdomain: subdomain.toLowerCase().trim() },
      include: {
        workspace: true
      }
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    return project;
  }
};

export default ProjectService;
