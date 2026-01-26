import { asyncHandler } from '../../utils/asyncHandler';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken, getTokenExpiryInSeconds } from '../../utils/jwt';
import { verifyTokenHash, hashToken } from '../../utils/password';
import { UnauthorizedError, InternalServerError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';

/**
 * Refresh access token using refresh token cookie
 * POST /auth/refresh
 */
export const refreshController = asyncHandler(async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token not found', { hint: 'Please login again' });
    }

    // Verify refresh token signature and expiration
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error: any) {
      logger.warn('Invalid refresh token used', {
        error: error.message
      });
      throw new UnauthorizedError('Invalid or expired refresh token', { hint: 'Please login again' });
    }

    const userId = decoded.sub;

    // Query database for the token record
    const [[tokenRecord]] = (await db.query(
      'SELECT id, token_hash, expires_at, revoked_at FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [userId]
    )) as any[];

    if (!tokenRecord) {
      logger.warn('Refresh token not found in database', {
        userId
      });
      throw new UnauthorizedError('Refresh token invalid', { hint: 'Please login again' });
    }

    // Check if token is revoked
    if (tokenRecord.revoked_at) {
      logger.warn('Attempt to use revoked refresh token', {
        userId
      });
      throw new UnauthorizedError('Refresh token has been revoked', { hint: 'Please login again' });
    }

    // Verify token hash matches
    const isTokenValid = await verifyTokenHash(refreshToken, tokenRecord.token_hash);

    if (!isTokenValid) {
      logger.warn('Refresh token hash mismatch', {
        userId
      });
      throw new UnauthorizedError('Refresh token invalid', { hint: 'Please login again' });
    }

    // Get user info
    const [[user]] = (await db.query(
      'SELECT id, email, role, status, first_name, last_name FROM users WHERE id = ?',
      [userId]
    )) as any[];

    if (!user || user.status !== 'active') {
      logger.warn('Attempt to refresh token for inactive user', {
        userId,
        status: user?.status || 'not found'
      });
      throw new UnauthorizedError('User account is inactive', { hint: 'Please login again' });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(userId, user.email, user.role);
    const newRefreshToken = generateRefreshToken(userId);
    const newRefreshTokenHash = await hashToken(newRefreshToken);

    // Calculate expiration
    const expiresInSeconds = 7 * 24 * 60 * 60; // 7 days
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // Optional: Rotate refresh token (revoke old, insert new)
    // This is more secure but requires updating frontend cookie
    if (process.env.ENABLE_REFRESH_TOKEN_ROTATION === 'true') {
      // Revoke old token
      await db.query(
        'UPDATE refresh_tokens SET rotated_token_hash = ? WHERE id = ?',
        [newRefreshTokenHash, tokenRecord.id]
      );

      // Insert new token
      await db.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [userId, newRefreshTokenHash, expiresAt]
      );

      // Set new refresh token cookie
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: expiresInSeconds * 1000
      });

      logger.info('Refresh token rotated', {
        userId
      });
    } else {
      // Reuse approach (simpler, old token stays valid)
      logger.info('Access token refreshed', {
        userId
      });
    }

    // Return new access token
    res.json({
      success: true,
      data: {
        user: {
          id: userId,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        },
        accessToken: newAccessToken,
        expiresIn: getTokenExpiryInSeconds(newAccessToken)
      }
    });
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    logger.error('Refresh token processing failed', {
      error: error.message
    });

    throw new UnauthorizedError('Refresh failed', { hint: 'Please login again' });
  }
});
