/**
 * Email Verification Controller
 * POST /auth/verify-email
 * 
 * Verifies user's email with OTP and grants login access
 */

import { asyncHandler } from '../../utils/asyncHandler';
import { generateAccessToken, generateRefreshToken, getTokenExpiryInSeconds } from '../../utils/jwt';
import { hashToken } from '../../utils/password';
import { BadRequestError, UnauthorizedError, InternalServerError, NotFoundError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';
import { enqueueSendWelcomeEmailJob } from '../../queues/welcome-email.queue';
import { auth } from '../../config/auth';
import { getClientIP, getDeviceName } from '../../utils/validation';
import { verifyUserOtpFromRedis } from '../../services/otp-redis.service';

/**
 * Verify email with OTP
 */
export const verifyEmailController = asyncHandler(async (req, res) => {
  const { userId, otpCode } = req.body;

  // Validate input
  if (!userId || !otpCode) {
    throw new BadRequestError('userId and otpCode are required');
  }

  if (otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
    throw new BadRequestError('Invalid OTP format');
  }

  try {
    // Get user
    const [[user]] = (await db.query(
      'SELECT id, email, first_name, last_name, email_verified FROM users WHERE id = ?',
      [userId]
    )) as any[];

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if already verified
    if (user.email_verified) {
      return res.status(200).json({
        success: true,
        data: {
          message: 'Email already verified',
          verified: true
        }
      });
    }

    // Verify OTP from Redis (hashed, with TTL and attempt limits)
    const otpResult = await verifyUserOtpFromRedis(userId.toString(), otpCode);

    if (otpResult.status === 'NOT_FOUND') {
      throw new UnauthorizedError('No active OTP found or OTP has expired. Please request a new one.');
    }

    if (otpResult.status === 'TOO_MANY_ATTEMPTS') {
      logger.warn('Too many OTP attempts', {
        userId,
        attempts: otpResult.attempts,
        maxAttempts: otpResult.maxAttempts
      });
      throw new UnauthorizedError('Too many failed attempts. Please request a new OTP.');
    }

    if (otpResult.status === 'INVALID') {
      logger.warn('Invalid OTP attempt', {
        userId,
        attempts: otpResult.attempts,
        maxAttempts: otpResult.maxAttempts
      });
      throw new UnauthorizedError('Invalid OTP code');
    }

    // Mark user email as verified and activate account
    await db.query(
      'UPDATE users SET email_verified = TRUE, status = ? WHERE id = ?',
      ['ACTIVE', userId]
    );

    // Generate tokens
    const accessToken = generateAccessToken(userId, user.email, 'USER');
    const refreshToken = generateRefreshToken(userId);
    const refreshTokenHash = await hashToken(refreshToken);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + auth.refreshTokenExpirySeconds * 1000);

    // Store refresh token hash
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent, device_name) VALUES (?, ?, ?, ?, ?, ?)',
      [
        userId,
        refreshTokenHash,
        expiresAt,
        getClientIP(req),
        req.headers['user-agent'] || 'Unknown',
        getDeviceName(req.headers['user-agent'] || '')
      ]
    );

    // Enqueue welcome email job (event-based)
    await enqueueSendWelcomeEmailJob({
      email: user.email,
      firstName: user.first_name
    });

    // Log verification
    logger.info('User email verified', {
      userId,
      email: user.email,
      ipAddress: getClientIP(req)
    });

    // Set refresh token cookie
    res.cookie(auth.cookies.refreshTokenName, refreshToken, {
      httpOnly: auth.cookies.httpOnly,
      secure: auth.cookies.secure,
      sameSite: auth.cookies.sameSite,
      maxAge: auth.cookies.maxAge
    });

    // Return response with tokens
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: userId,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name
        },
        accessToken,
        expiresIn: getTokenExpiryInSeconds(accessToken),
        verified: true,
        message: 'Email verified successfully'
      }
    });
  } catch (error: any) {
    logger.error('Email verification failed', {
      userId,
      error: error.message
    });

    if (
      error instanceof BadRequestError ||
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError
    ) {
      throw error;
    }

    throw new InternalServerError('Email verification failed');
  }
});

/**
 * Resend OTP to user's email
 * POST /auth/resend-otp
 */
// Moved to resend-otp.controller.ts
