import { asyncHandler } from '../../utils/asyncHandler';
import { BadRequestError, InternalServerError, UnauthorizedError, NotFoundError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';
import { isValidPassword } from '../../utils/validation';
import { hashPassword } from '../../utils/password';
import { verifyAndConsumePasswordResetToken } from '../../services/password-reset-redis.service';

/**
 * Reset Password Controller
 * POST /auth/reset-password
 *
 * Body:
 *   - userId (string)
 *   - token (string)
 *   - password (string)
 *   - confirmPassword (string)
 */
export const resetPasswordController = asyncHandler(async (req, res) => {
  const { userId, token, password, confirmPassword } = req.body as {
    userId?: string;
    token?: string;
    password?: string;
    confirmPassword?: string;
  };

  if (!userId || !token || !password || !confirmPassword) {
    throw new BadRequestError('userId, token, password, and confirmPassword are required');
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
    const [[user]] = (await db.query(
      'SELECT id, email_verified FROM users WHERE id = ? LIMIT 1',
      [userId]
    )) as any[];

    if (!user) {
      throw new NotFoundError('Invalid or expired reset token');
    }

    if (!user.email_verified) {
      throw new UnauthorizedError('Email not verified. Please verify your email before resetting password.');
    }

    const isValidToken = await verifyAndConsumePasswordResetToken(userId.toString(), token);
    if (!isValidToken) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(password);

    await db.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, userId]
    );

    // Optional: revoke existing refresh tokens for this user
    await db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);

    logger.info('Password reset successfully', { userId });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Password has been reset successfully. Please log in with your new password.'
      }
    });
  } catch (error: any) {
    logger.error('Password reset failed', {
      userId,
      error: error.message
    });

    if (error instanceof BadRequestError || error instanceof UnauthorizedError || error instanceof NotFoundError) {
      throw error;
    }

    throw new InternalServerError('Failed to reset password');
  }
});
