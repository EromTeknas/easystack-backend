import { asyncHandler } from '../../utils/asyncHandler';
import { UnauthorizedError, InternalServerError } from '../../errors';
import logger from '../../utils/logger';
import { auth } from '../../config/auth';
import { ok } from '../../utils/response';
import { rotateRefreshToken } from '../../services/auth-tokens.service';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../../utils/auth-cookies';

/**
 * Refresh access token using refresh token cookie
 * POST /auth/refresh
 * 
 * Features:
 * - Token rotation enabled (old token revoked, new one issued)
 * - Security: prevents token replay attacks
 * - Each refresh issues new access + refresh token pair
 */
export const refreshController = asyncHandler(async (req, res) => {
  logger.info('POST /api/auth/refresh start');
  try {
    try {
      const refreshToken = req.cookies?.[auth.cookies.refreshTokenName];

      if (!refreshToken) {
        throw new UnauthorizedError('Refresh token not found');
      }

      // Validate and rotate refresh token
      const rotated = await rotateRefreshToken(refreshToken, req);

      setAccessTokenCookie(res, rotated.accessToken);
      setRefreshTokenCookie(res, rotated.refreshToken);

      logger.info('Refresh token rotated successfully', {
        userId: rotated.user.id
      });

      // Return new tokens
      return ok(res, {
        user: {
          id: rotated.user.id.toString(),
          email: rotated.user.email,
          firstName: rotated.user.firstName,
          lastName: rotated.user.lastName
        }
      });
    } catch (error: any) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }

      logger.error('Refresh token processing failed', {
        error: error.message
      });

      throw new UnauthorizedError('Refresh failed');
    }
  } finally {
    logger.info('POST /api/auth/refresh end');
  }
});
