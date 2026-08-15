import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { BadRequestError } from '../../errors';
import { ProjectService } from '../../services/project.service';

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
 * Get public project information by subdomain (PUBLIC - no auth required)
 */
export const getProjectBySubdomain = asyncHandler(async (req: any, res: Response) => {
  const { subdomain } = req.params;

  if (!subdomain || typeof subdomain !== 'string') {
    throw new BadRequestError('subdomain is required');
  }

  const project = await ProjectService.getProjectBySubdomain(subdomain);

  return ok(res, {
    project: serializeProject(project),
  });
});
