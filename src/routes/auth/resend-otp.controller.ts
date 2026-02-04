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
import { ok } from '../../utils/response';
import { generateOtpCode, hashOtp } from '../../utils/otp';
import { storeUserOtp } from '../../services/otp-redis.service';
import { enqueueSendOtpEmailJob } from '../../queues/email-otp.queue';

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
      return ok(res, {
        message: 'Email already verified'
      });
    }

    // Generate new OTP
    const otpCode = generateOtpCode();
    const otpCodeHash = await hashOtp(otpCode);

    // Store new OTP in Redis (overwrites any existing OTP for this user)
    await storeUserOtp(userId.toString(), otpCodeHash);

    // Enqueue OTP email job
    await enqueueSendOtpEmailJob({
      email: user.email,
      firstName: user.first_name,
      otpCode
    });

    logger.info('OTP resent', {
      userId,
      email: user.email
    });

    return ok(res, {
      message: 'OTP sent to your email',
      email: user.email
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
