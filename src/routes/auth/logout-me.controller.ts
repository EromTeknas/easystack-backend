import { asyncHandler } from '../../utils/asyncHandler';
import { verifyRefreshToken } from '../../utils/jwt';
import { UnauthorizedError, InternalServerError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';

/**
 * Logout user by revoking refresh token
 * POST /auth/logout
 */
export const logoutController = asyncHandler(async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      // Even without a token, respond with success
      res.clearCookie('refreshToken');
      return res.json({
        success: true,
        data: {
          message: 'Logged out successfully'
        }
      });
    }

    // Verify token to get user ID
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      // Token is invalid or expired, just clear cookie
      res.clearCookie('refreshToken');
      return res.json({
        success: true,
        data: {
          message: 'Logged out successfully'
        }
      });
    }

    const userId = decoded.sub;

    // Revoke the refresh token
    await db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [userId]
    );

    logger.info('User logged out', {
      userId
    });

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({
      success: true,
      data: {
        message: 'Logged out successfully'
      }
    });
  } catch (error: any) {
    logger.error('Logout failed', {
      error: error.message
    });

    // Still clear cookie even if DB operation fails
    res.clearCookie('refreshToken');

    throw new InternalServerError('Logout failed');
  }
});

/**
 * Get current authenticated user
 * GET /auth/me
 */
export const getMeController = asyncHandler(async (req: any, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    // Get user details
    const [[user]] = (await db.query(
      'SELECT id, email, first_name, last_name, role, status, email_verified, email_verified_at, last_login_at, created_at FROM users WHERE id = ?',
      [userId]
    )) as any[];

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id.toString(),
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          email_verified: user.email_verified,
          email_verified_at: user.email_verified_at,
          last_login_at: user.last_login_at,
          created_at: user.created_at
        }
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
});
