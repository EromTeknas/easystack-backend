/**
 * Resend OTP Controller
 * POST /auth/resend-otp
 * 
 * Resends OTP code to user's email for email verification
 */

import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError, NotFoundError, InternalServerError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';
import { generateOtpCode, hashOtp, calculateOtpExpiry } from '../../utils/otp';
import { sendOtpEmail } from '../../services/email.service';

/**
 * Resend OTP to user's email
 * POST /auth/resend-otp
 */
export const resendOtpController = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    throw new BadRequestError('userId is required');
  }

  try {
    // Get user
    const [[user]] = (await db.query(
      'SELECT id, email, first_name, email_verified FROM users WHERE id = ?',
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
          message: 'Email already verified'
        }
      });
    }

    // Delete old OTPs
    await db.query(
      'DELETE FROM email_otps WHERE user_id = ? AND verified_at IS NULL',
      [userId]
    );

    // Generate new OTP
    const otpCode = generateOtpCode();
    const otpCodeHash = await hashOtp(otpCode);
    const expiresAt = calculateOtpExpiry();

    // Store new OTP
    await db.query(
      'INSERT INTO email_otps (user_id, otp_code_hash, expires_at) VALUES (?, ?, ?)',
      [userId, otpCodeHash, expiresAt]
    );

    // Send OTP
    const emailSent = await sendOtpEmail(user.email, user.first_name, otpCode);

    if (!emailSent) {
      logger.warn('Failed to send OTP email', { userId });
    }

    logger.info('OTP resent', {
      userId,
      email: user.email
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'OTP sent to your email',
        email: user.email
      }
    });
  } catch (error: any) {
    logger.error('OTP resend failed', {
      userId,
      error: error.message
    });

    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error;
    }

    throw new InternalServerError('Failed to resend OTP');
  }
});
