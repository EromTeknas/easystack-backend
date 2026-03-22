import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError, NotFoundError } from '../../errors';
import { ProjectService } from '../../services/project.service';
import { prisma } from '../../db';
import logger from '../../utils/logger';

/**
 * GET /projects/subdomain-available/:subdomain
 * Check if a subdomain is available (PUBLIC - no auth required)
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
 * GET /projects/by-subdomain/:subdomain
 * Get a project by subdomain (PUBLIC - no auth required)
 * Returns public project info without sensitive data
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

  // Return only public data
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
