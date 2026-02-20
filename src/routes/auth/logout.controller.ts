import { asyncHandler } from '../../utils/asyncHandler';
import { verifyRefreshToken } from '../../utils/jwt';
import { InternalServerError } from '../../errors';
import { prisma } from '../../db';
import logger from '../../utils/logger';
import { auth } from '../../config/auth';
import { clearAuthCookies } from '../../utils/auth-cookies';
import { ok } from '../../utils/response';

/**
 * Logout user by revoking refresh token
 * POST /auth/logout
 */
export const logoutController = asyncHandler(async (req, res) => {
  logger.info('POST /api/auth/logout start');
  try {
    try {
      const refreshToken = req.cookies?.[auth.cookies.refreshTokenName];

      if (!refreshToken) {
        // Even without a token, respond with success
        clearAuthCookies(res);
        return ok(res, {
          message: 'Logged out successfully'
        });
      }

      // Verify token to get user ID
      let decoded;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch {
        // Token is invalid or expired, just clear cookie
        clearAuthCookies(res);
        return ok(res, {
          message: 'Logged out successfully'
        });
      }

      const userId = Number(decoded.sub);

      // Revoke all refresh tokens for this user
      await prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      logger.info('User logged out', {
        userId
      });

      // Clear refresh token cookie
      clearAuthCookies(res);

      return ok(res, {
        message: 'Logged out successfully'
      });
    } catch (error: any) {
      logger.error('Logout failed', {
        error: error.message
      });

      // Still clear cookie even if DB operation fails
      clearAuthCookies(res);

      throw new InternalServerError('Logout failed');
    }
  } finally {
    logger.info('POST /api/auth/logout end');
  }
});


