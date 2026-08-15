import { prisma } from '../db';
import { BadRequestError, NotFoundError } from '../errors';
import logger from '../utils/logger';
import ResourceIdService from './resource-id.service';

export const ProjectService = {
  /**
   * Create a new project in a workspace
   */
  async createProject(
    workspaceId: number,
    data: { name: string; subdomain: string; description?: string; createdById: number }
  ): Promise<number> {
    const { name, subdomain, description, createdById } = data;

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
      where: { slug: subdomain.toLowerCase().trim() }
    })

    if (existingProject) {
      throw new BadRequestError('Subdomain is already taken');
    }

    try {
      const project = await prisma.project.create({
        data: {
          resourceId: await ResourceIdService.generateUniqueProjectId(prisma),
          workspaceId,
          createdById,
          name: name.trim(),
          slug: subdomain.toLowerCase().trim(),
          description: description?.trim() || null
        }
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
    if (data.subdomain && data.subdomain !== existingProject.slug) {
      const normalizedNewSubdomain = data.subdomain.toLowerCase().trim();

      const subdomainRegex = /^[a-z0-9_-]+$/i;
      if (!subdomainRegex.test(normalizedNewSubdomain)) {
        throw new BadRequestError('Subdomain can only contain alphanumeric characters, hyphens, and underscores');
      }

      const conflictingProject = await prisma.project.findUnique({
        where: { slug: normalizedNewSubdomain }
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
      updateData.slug = data.subdomain.toLowerCase().trim();
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
      where: { slug: normalizedSubdomain }
    });

    return !existingProject;
  },

  /**
   * Get a project by subdomain (public lookup)
   */
  async getProjectBySubdomain(subdomain: string): Promise<any> {
    const project = await prisma.project.findUnique({
      where: { slug: subdomain.toLowerCase().trim() },
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
