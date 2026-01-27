/**
 * Email Verification Controller
 * POST /auth/verify-email
 * 
 * Verifies user's email with OTP and grants login access
 */

import { asyncHandler } from '../../utils/asyncHandler';
import { generateAccessToken, generateRefreshToken, getTokenExpiryInSeconds } from '../../utils/jwt';
import { hashToken, verifyTokenHash } from '../../utils/password';
import { verifyOtp, isOtpExpired } from '../../utils/otp';
import { BadRequestError, UnauthorizedError, InternalServerError, NotFoundError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';
import { sendWelcomeEmail } from '../../services/email.service';
import { auth } from '../../config/auth';
import { getClientIP, getDeviceName } from '../../utils/validation';

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

    // Get active OTP
    const [[otpRecord]] = (await db.query(
      `SELECT id, otp_code_hash, expires_at, attempts, max_attempts, verified_at
       FROM email_otps
       WHERE user_id = ? AND verified_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    )) as any[];

    if (!otpRecord) {
      throw new UnauthorizedError('No active OTP found. Please request a new one.');
    }

    // Check if OTP has expired
    if (isOtpExpired(new Date(otpRecord.expires_at))) {
      throw new UnauthorizedError('OTP has expired. Please request a new one.');
    }

    // Check attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      throw new UnauthorizedError('Too many failed attempts. Please request a new OTP.');
    }

    // Verify OTP code
    const isValid = await verifyTokenHash(otpCode, otpRecord.otp_code_hash);

    if (!isValid) {
      // Increment attempts
      await db.query(
        'UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?',
        [otpRecord.id]
      );

      logger.warn('Invalid OTP attempt', {
        userId,
        attempts: otpRecord.attempts + 1,
        maxAttempts: otpRecord.max_attempts
      });

      throw new UnauthorizedError('Invalid OTP code');
    }

    // Mark OTP as verified
    await db.query(
      'UPDATE email_otps SET verified_at = NOW() WHERE id = ?',
      [otpRecord.id]
    );

    // Mark user email as verified
    await db.query(
      'UPDATE users SET email_verified = TRUE WHERE id = ?',
      [userId]
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

    // Send welcome email
    const emailSent = await sendWelcomeEmail(user.email, user.first_name);
    if (!emailSent) {
      logger.warn('Failed to send welcome email', { userId });
    }

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
