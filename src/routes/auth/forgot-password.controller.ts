import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError, InternalServerError } from '../../errors';
import { prisma } from '../../db';
import logger from '../../utils/logger';
import { isValidEmail } from '../../utils/validation';
import { generateOtpCode, hashOtp } from '../../utils/otp';
import { storeUserOtp } from '../../services/otp-redis.service';
import { createPasswordResetToken } from '../../services/password-reset-redis.service';
import { enqueueSendOtpEmailJob } from '../../queues/email-otp.queue';
import { enqueueSendPasswordResetEmailJob } from '../../queues/password-reset.queue';
import { ok } from '../../utils/response';

/**
 * Forgot Password Controller
 * POST /auth/forgot-password
 *
 * Correct behavior:
 * - If user does not exist: respond success (generic message)
 * - If user exists AND email_verified = false:
 *     - Block password reset
 *     - Resend verification OTP instead
 * - If user exists AND email_verified = true:
 *     - (Future) generate password reset token & email
 *     - For now, respond generic success stub
 */
export const forgotPasswordController = asyncHandler(async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  if (!isValidEmail(email)) {
    throw new BadRequestError('Invalid email format');
  }

  const normalizedEmail = email.toLowerCase();

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        emailVerified: true
      }
    });

    // If user does not exist, return generic success to avoid leaking existence
    if (!user) {
      return ok(res, {
        message: 'If an account exists with this email, we have sent password reset instructions.'
      });
    }

    // If email is not verified, block password reset and resend verification OTP
    if (!user.emailVerified) {
      const userId = user.id.toString();

      const otpCode = generateOtpCode();
      const otpCodeHash = await hashOtp(otpCode);
      await storeUserOtp(userId, otpCodeHash);

      await enqueueSendOtpEmailJob({
        email: user.email,
        firstName: user.firstName || '',
        otpCode
      });

      logger.info('Blocked password reset for unverified user; resent verification OTP', {
        userId,
        email: user.email
      });

      return ok(res, {
        message: 'Please verify your email first. We have resent the verification code to your inbox.',
        requiresEmailVerification: true,
        nextStep: 'verify-email'
      });
    }

    // Email is verified: generate password reset token, store hash in Redis, and enqueue email
    const userId = user.id.toString();
    const token = await createPasswordResetToken(userId);

    await enqueueSendPasswordResetEmailJob({
      email: user.email,
      firstName: user.firstName || '',
      token
    });

    logger.info('Password reset requested for verified user', { userId, email: user.email });

    return ok(res, {
      message: 'If an account exists with this email, we have sent password reset instructions.'
    });
  } catch (error: any) {
    logger.error('Forgot password request failed', {
      email: normalizedEmail,
      error: error.message
    });

    if (error instanceof BadRequestError) {
      throw error;
    }

    throw new InternalServerError('Failed to process forgot password request');
  }
});
