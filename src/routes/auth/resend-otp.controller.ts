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
import { enqueueSendOtpEmailJob } from '../../queues/email-otp.queue';
import { getEmailVerificationRecord, updateEmailVerificationOtpHash } from '../../services/email-verification-redis.service';

/**
 * Resend OTP to user's email
 * POST /auth/resend-otp
 */
export const resendOtpController = asyncHandler(async (req, res) => {
  const { verificationToken } = req.body;

  if (!verificationToken) {
    throw new BadRequestError('verificationToken is required');
  }

  try {
    // Resolve verification token from Redis to obtain userId and email
    const verificationRecord = await getEmailVerificationRecord(verificationToken);

    if (!verificationRecord) {
      throw new NotFoundError('Verification token not found or has expired');
    }

    const userId = verificationRecord.userId;

    // Get user from DB to validate status and get firstName
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

    // Update OTP hash in the existing verification token record
    await updateEmailVerificationOtpHash(verificationToken, otpCodeHash);

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
      verificationToken,
      error: error.message
    });

    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error;
    }

    throw new InternalServerError('Failed to resend OTP');
  }
});
