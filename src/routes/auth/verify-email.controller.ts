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
import { prisma } from '../../db';
import logger from '../../utils/logger';
import { ok } from '../../utils/response';
import { enqueueSendWelcomeEmailJob } from '../../queues/welcome-email.queue';
import { createDefaultWorkspace, addWorkspaceMember } from '../../services/workspace.service';
import { auth } from '../../config/auth';
import { getClientIP, getDeviceName } from '../../utils/validation';
import { getEmailVerificationRecord, deleteEmailVerificationToken } from '../../services/email-verification-redis.service';
import { verifyOtp } from '../../utils/otp';

export const verifyEmailController = asyncHandler(async (req, res) => {
  logger.info('POST /api/auth/verify-email start');
  try {
    const { verificationToken, otpCode } = req.body;

    // Validate input
    if (!verificationToken || typeof verificationToken !== 'string') {
      throw new BadRequestError('verificationToken is required');
    }

    if (!otpCode || typeof otpCode !== 'string') {
      throw new BadRequestError('otpCode is required');
    }

    try {
      // Get user
      // Resolve verification token from Redis (maps token -> user + email + otpHash + purpose)
      const verificationRecord = await getEmailVerificationRecord(verificationToken);

      if (!verificationRecord || verificationRecord.purpose !== 'EMAIL_VERIFICATION') {
        throw new UnauthorizedError('Invalid or expired verification token');
      }

      // Validate OTP against stored hash
      const isValidOtp = await verifyOtp(otpCode, verificationRecord.otpHash);

      if (!isValidOtp) {
        throw new UnauthorizedError('Invalid OTP code');
      }

      // OTP is valid - consume the verification token to prevent reuse
      await deleteEmailVerificationToken(verificationToken);

      const userId = Number(verificationRecord.userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          emailVerified: true,
          status: true
        }
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if already verified
      if (user.emailVerified) {
        return ok(res, {
          message: 'Email already verified',
          verified: true
        });
      }

      // Mark user email as verified and activate account
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true, status: 'ACTIVE' }
      });

      // Ensure user has a default workspace and membership (created after verification)
      const existingMembership = await prisma.workspaceMember.findFirst({
        where: { userId: userId },
        select: { id: true }
      });

      if (!existingMembership) {
        const workspaceId = await createDefaultWorkspace(userId.toString());
        await addWorkspaceMember(workspaceId, userId.toString(), 'OWNER');
      }

      // Generate tokens
      const accessToken = generateAccessToken(userId.toString(), user.email, 'USER');
      const refreshToken = generateRefreshToken(userId.toString());
      const refreshTokenHash = await hashToken(refreshToken);

      // Calculate expiration
      const expiresAt = new Date(Date.now() + auth.refreshTokenExpirySeconds * 1000);

      // Store refresh token hash via Prisma
      await prisma.refreshToken.create({
        data: {
          userId,
          tokenHash: refreshTokenHash,
          expiresAt,
          ipAddress: getClientIP(req),
          userAgent: (req.headers['user-agent'] as string) || 'Unknown',
          deviceName: getDeviceName((req.headers['user-agent'] as string) || '')
        }
      });

      // Enqueue welcome email job (event-based)
      await enqueueSendWelcomeEmailJob({
        email: user.email,
        firstName: user.firstName || ''
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
      return ok(res, {
        user: {
          id: userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        accessToken,
        expiresIn: getTokenExpiryInSeconds(accessToken),
        verified: true,
        message: 'Email verified successfully'
      });
    } catch (error: any) {
      logger.error('Email verification failed', {
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
  } finally {
    logger.info('POST /api/auth/verify-email end');
  }
});

/**
 * Resend OTP to user's email
 * POST /auth/resend-otp
 */
// Moved to resend-otp.controller.ts
