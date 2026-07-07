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
import { verifyAccessToken } from '../../utils/jwt';
import { auth } from '../../config/auth';
import { rotateRefreshToken } from '../../services/auth-tokens.service';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../../utils/auth-cookies';
import WorkspaceRepository from '../../repositories/workspace.repository';
import { BillingService } from '../../services/billing.service';

/**
 * Get current authenticated user with workspaces
 * GET /auth/me
 */
export const getMeController = asyncHandler(async (req: any, res) => {
  logger.info('GET /api/auth/me start');
  try {
    try {
      const accessToken = req.cookies?.[auth.cookies.accessTokenName];
      let userId: string | null = null;

      if (accessToken) {
        try {
          const decoded = verifyAccessToken(accessToken);
          userId = decoded.sub;
        } catch (error: any) {
          if (error.message !== 'Token expired') {
            throw new UnauthorizedError('Invalid token');
          }
        }
      }

      if (!userId) {
        const refreshToken = req.cookies?.[auth.cookies.refreshTokenName];
        if (!refreshToken) {
          throw new UnauthorizedError('Not authenticated');
        }

        const rotated = await rotateRefreshToken(refreshToken, req);
        setAccessTokenCookie(res, rotated.accessToken);
        setRefreshTokenCookie(res, rotated.refreshToken);
        userId = rotated.user.id.toString();
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
          onboardingCompleted: true,
          status: true,
          createdAt: true,
          defaultWorkspaceId: true,
        }
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Get user's workspaces
      const workspaces = await WorkspaceRepository.getUserWorkspaces(Number(userId));

      const billing = user.defaultWorkspaceId
        ? await BillingService.get(user.defaultWorkspaceId)
        : null;
      const effectivePlan = user.defaultWorkspaceId
        ? await BillingService.getEffectivePlan(user.defaultWorkspaceId)
        : null;

      return ok(res, {
        user: {
          id: user.id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
          onboardingCompleted: user.onboardingCompleted,
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
        // Expose a unified billing object to the frontend
        billing: {
          plan: effectivePlan,
          subscription: billing?.subscription ?? null,
          usage: billing?.usage ?? {},
          features: billing?.features ?? {},
        },
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
