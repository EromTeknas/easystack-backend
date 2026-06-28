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
