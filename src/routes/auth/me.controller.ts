/**
 * Get Me Controller
 * GET /auth/me
 * 
 * Returns current authenticated user with all their workspaces
 */

import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError, InternalServerError } from '../../errors';
import { prisma } from '../../db';
import logger from '../../utils/logger';
import { ok } from '../../utils/response';
import { getUserWorkspaces } from '../../services/workspace.service';
import { BillingService } from '../../services/billing.service';

/**
 * Get current authenticated user with workspaces
 * GET /auth/me
 */
export const getMeController = asyncHandler(async (req: any, res) => {
  logger.info('GET /api/auth/me start');
  try {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Not authenticated');
      }

      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: Number(userId) },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          emailVerified: true,
          status: true,
          createdAt: true
        }
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Get user's workspaces
      const workspaces = await getUserWorkspaces(Number(userId));
      
      // Get user's effective plan (with custom overrides applied)
      const effectivePlan = await BillingService.getEffectivePlan(Number(userId));

      return ok(res, {
        user: {
          id: user.id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
          status: user.status,
          createdAt: user.createdAt
        },
        workspaces: workspaces.map((w: any) => ({
          id: w.id,
          name: w.name,
          logoUrl: w.logo_url,
          role: w.role,
          createdAt: w.created_at
        })),
        plan: {
          id: effectivePlan.id,
          name: effectivePlan.name,
          displayName: effectivePlan.displayName,
          limits: effectivePlan.config.limits,
          features: effectivePlan.config.features,
          pricing: effectivePlan.config.pricing
        }
      });
    } catch (error: any) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }

      logger.error('Failed to get user profile', {
        userId: req.user?.id,
        error: error.message
      });

      throw new InternalServerError('Failed to retrieve user profile');
    }
  } finally {
    logger.info('GET /api/auth/me end');
  }
});
