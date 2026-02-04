import { asyncHandler } from '../../utils/asyncHandler';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken, getTokenExpiryInSeconds } from '../../utils/jwt';
import { verifyTokenHash, hashToken } from '../../utils/password';
import { UnauthorizedError, InternalServerError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';
import { auth } from '../../config/auth';
import { getClientIP, getDeviceName } from '../../utils/validation';
import { ok } from '../../utils/response';

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
  try {
    const refreshToken = req.cookies?.[auth.cookies.refreshTokenName];

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

    // Query database for the token record (only non-revoked tokens)
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
      'SELECT id, email, status, first_name, last_name FROM users WHERE id = ?',
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
    const newAccessToken = generateAccessToken(userId, user.email, 'USER');
    const newRefreshToken = generateRefreshToken(userId);
    const newRefreshTokenHash = await hashToken(newRefreshToken);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + auth.refreshTokenExpirySeconds * 1000);

    // ALWAYS rotate tokens (revoke old, insert new)
    // This prevents token replay attacks and improves security
    await db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?',
      [tokenRecord.id]
    );

    // Insert new token
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent, device_name) VALUES (?, ?, ?, ?, ?, ?)',
      [
        userId,
        newRefreshTokenHash,
        expiresAt,
        getClientIP(req),
        req.headers['user-agent'] || 'Unknown',
        getDeviceName(req.headers['user-agent'] || '')
      ]
    );

    // Set new refresh token cookie
    res.cookie(auth.cookies.refreshTokenName, newRefreshToken, {
      httpOnly: auth.cookies.httpOnly,
      secure: auth.cookies.secure,
      sameSite: auth.cookies.sameSite,
      maxAge: auth.cookies.maxAge
    });

    logger.info('Refresh token rotated successfully', {
      userId
    });

    // Return new tokens
    return ok(res, {
      user: {
        id: userId,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      },
      accessToken: newAccessToken,
      expiresIn: getTokenExpiryInSeconds(newAccessToken)
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
