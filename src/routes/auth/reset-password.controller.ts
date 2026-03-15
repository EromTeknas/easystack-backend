import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError, InternalServerError, UnauthorizedError, NotFoundError } from '../../errors';
import { prisma } from '../../db';
import logger from '../../utils/logger';
import { ok } from '../../utils/response';
import { isValidPassword } from '../../utils/validation';
import { hashPassword } from '../../utils/password';
import { verifyAndConsumePasswordResetToken } from '../../services/password-reset-redis.service';

/**
 * Reset Password Controller (transactional)
 * POST /auth/reset-password
 *
 * Atomically updates password and revokes existing refresh tokens
 * If any step fails, all changes are rolled back
 *
 * Body:
 *   - token (string)
 *   - password (string)
 *   - confirmPassword (string)
 */
export const resetPasswordController = asyncHandler(async (req, res) => {
  logger.info('POST /api/auth/reset-password start');
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

  // Verify token and get userId (outside transaction)
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

  // Transactional: Update password + revoke refresh tokens
  await prisma.$transaction(async (tx) => {
    // Step 1: Update user password
    await tx.user.update({
      where: { id: Number(userId) },
      data: { passwordHash }
    });

    logger.info('Password updated in transaction', { userId });

    // Step 2: Revoke all refresh tokens for this user
    await tx.refreshToken.deleteMany({ where: { userId: Number(userId) } });

    logger.info('Refresh tokens revoked in transaction', { userId });
  });

  return ok(res, {
    message: 'Password has been reset successfully. Please log in with your new password.'
  });
});
