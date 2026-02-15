/**
 * Resend OTP Controller
 * POST /auth/resend-otp
 * 
 * Resends OTP code to user's email for email verification
 */

import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError, NotFoundError, InternalServerError } from '../../errors';
import { prisma } from '../../db';
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
  logger.info('POST /api/auth/resend-otp start');
  try {
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

      const userId = Number(verificationRecord.userId);

      // Get user from DB to validate status and get firstName
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          emailVerified: true
        }
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if already verified
      if (user.emailVerified) {
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
        firstName: user.firstName || '',
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
  } finally {
    logger.info('POST /api/auth/resend-otp end');
  }
});
