import { asyncHandler } from '../../utils/asyncHandler';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken, getTokenExpiryInSeconds } from '../../utils/jwt';
import { verifyTokenHash, hashToken } from '../../utils/password';
import { UnauthorizedError, InternalServerError } from '../../errors';
import { prisma } from '../../db';
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
      throw new UnauthorizedError('Refresh token not found');
    }

    // Verify refresh token signature and expiration
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error: any) {
      logger.warn('Invalid refresh token used', {
        error: error.message
      });
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const userId = Number(decoded.sub);

    // Query database for the token record (only non-revoked tokens)
    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        userId,
        revokedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!tokenRecord) {
      logger.warn('Refresh token not found in database', {
        userId
      });
      throw new UnauthorizedError('Refresh token invalid');
    }

    // Check if token is revoked
    if (tokenRecord.revokedAt) {
      logger.warn('Attempt to use revoked refresh token', {
        userId
      });
      throw new UnauthorizedError('Refresh token has been revoked');
    }

    // Verify token hash matches
    const isTokenValid = await verifyTokenHash(refreshToken, tokenRecord.tokenHash);

    if (!isTokenValid) {
      logger.warn('Refresh token hash mismatch', {
        userId
      });
      throw new UnauthorizedError('Refresh token invalid');
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user || user.status.toUpperCase() !== 'ACTIVE') {
      logger.warn('Attempt to refresh token for inactive user', {
        userId,
        status: user?.status || 'not found'
      });
      throw new UnauthorizedError('User account is inactive');
    }

    // Generate new tokens
    const subject = userId.toString();
    const newAccessToken = generateAccessToken(subject, user.email, 'USER');
    const newRefreshToken = generateRefreshToken(subject);
    const newRefreshTokenHash = await hashToken(newRefreshToken);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + auth.refreshTokenExpirySeconds * 1000);

    // ALWAYS rotate tokens (revoke old, insert new)
    // This prevents token replay attacks and improves security
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() }
    });

    // Insert new token
    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: newRefreshTokenHash,
        expiresAt,
        ipAddress: getClientIP(req),
        userAgent: (req.headers['user-agent'] as string) || 'Unknown',
        deviceName: getDeviceName((req.headers['user-agent'] as string) || '')
      }
    });

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
        id: subject,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
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

    throw new UnauthorizedError('Refresh failed');
  }
});
