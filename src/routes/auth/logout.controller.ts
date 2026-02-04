import { asyncHandler } from '../../utils/asyncHandler';
import { verifyRefreshToken } from '../../utils/jwt';
import { InternalServerError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';
import { auth } from '../../config/auth';
import { ok } from '../../utils/response';

/**
 * Logout user by revoking refresh token
 * POST /auth/logout
 */
export const logoutController = asyncHandler(async (req, res) => {
  try {
    const refreshToken = req.cookies?.[auth.cookies.refreshTokenName];

    if (!refreshToken) {
      // Even without a token, respond with success
      res.clearCookie(auth.cookies.refreshTokenName);
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
      res.clearCookie(auth.cookies.refreshTokenName);
      return ok(res, {
        message: 'Logged out successfully'
      });
    }

    const userId = decoded.sub;

    // Revoke all refresh tokens for this user
    await db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [userId]
    );

    logger.info('User logged out', {
      userId
    });

    // Clear refresh token cookie
    res.clearCookie(auth.cookies.refreshTokenName, {
      httpOnly: auth.cookies.httpOnly,
      secure: auth.cookies.secure,
      sameSite: auth.cookies.sameSite
    });

    return ok(res, {
      message: 'Logged out successfully'
    });
  } catch (error: any) {
    logger.error('Logout failed', {
      error: error.message
    });

    // Still clear cookie even if DB operation fails
    res.clearCookie(auth.cookies.refreshTokenName);

    throw new InternalServerError('Logout failed');
  }
});


