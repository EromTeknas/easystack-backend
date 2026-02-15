import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError, InternalServerError, UnauthorizedError, NotFoundError } from '../../errors';
import { prisma } from '../../db';
import logger from '../../utils/logger';
import { ok } from '../../utils/response';
import { isValidPassword } from '../../utils/validation';
import { hashPassword } from '../../utils/password';
import { verifyAndConsumePasswordResetToken } from '../../services/password-reset-redis.service';

/**
 * Reset Password Controller
 * POST /auth/reset-password
 *
 * Body:
 *   - token (string)
 *   - password (string)
 *   - confirmPassword (string)
 */
export const resetPasswordController = asyncHandler(async (req, res) => {
  logger.info('POST /api/auth/reset-password start');
  try {
    const { token, password, confirmPassword } = req.body as {
      token?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!token || !password || !confirmPassword) {
      throw new BadRequestError('token, password, and confirmPassword are required');
    }

    if (!isValidPassword(password)) {
      throw new BadRequestError('Password does not meet requirements', {
        field: 'password'
      });
    }

    if (password !== confirmPassword) {
      throw new BadRequestError('Password and confirm password do not match', {
        field: 'confirmPassword'
      });
    }

    try {
      // Derive userId from the reset token stored in Redis
      const userId = await verifyAndConsumePasswordResetToken(token);

      if (!userId) {
        throw new UnauthorizedError('Invalid or expired reset token');
      }

      const user = await prisma.user.findUnique({
        where: { id: Number(userId) },
        select: {
          id: true,
          emailVerified: true
        }
      });

      if (!user) {
        throw new NotFoundError('Invalid or expired reset token');
      }

      if (!user.emailVerified) {
        throw new UnauthorizedError('Email not verified. Please verify your email before resetting password.');
      }

      const passwordHash = await hashPassword(password);

      await prisma.user.update({
        where: { id: Number(userId) },
        data: { passwordHash }
      });

      // Optional: revoke existing refresh tokens for this user
      await prisma.refreshToken.deleteMany({ where: { userId: Number(userId) } });

      return ok(res, {
        message: 'Password has been reset successfully. Please log in with your new password.'
      });
    } catch (error: any) {
      logger.error('Password reset failed', {
        token,
        error: error.message
      });

      if (error instanceof BadRequestError || error instanceof UnauthorizedError || error instanceof NotFoundError) {
        throw error;
      }

      throw new InternalServerError('Failed to reset password');
    }
  } finally {
    logger.info('POST /api/auth/reset-password end');
  }
});
