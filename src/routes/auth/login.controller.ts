import { asyncHandler } from '../../utils/asyncHandler';
import { verifyPassword, hashToken } from '../../utils/password';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';
import { isValidEmail, getClientIP, getDeviceName } from '../../utils/validation';
import { BadRequestError, UnauthorizedError, InternalServerError } from '../../errors';
import { AUTH_ERROR_CODES } from '../../constants/errorCodes';
import { prisma } from '../../db';
import logger from '../../utils/logger';
import { auth } from '../../config/auth';
import { ok } from '../../utils/response';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../../utils/auth-cookies';

/**
 * Login with email and password
 * POST /auth/login
 * 
 * Requirements:
 * - Email must be verified before login
 * - Password must match
 * - Account must be active
 */
export const loginController = asyncHandler(async (req, res) => {
  logger.info('POST /api/auth/login start');
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    if (!isValidEmail(email)) {
      throw new BadRequestError('Invalid email format');
    }

    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          emailVerified: true,
          status: true,
          firstName: true,
          lastName: true
        }
      });

      if (!user) {
        logger.warn('Login attempt with non-existent email', {
          email: email.toLowerCase(),
          ipAddress: getClientIP(req)
        });
        throw new UnauthorizedError('Invalid email or password', AUTH_ERROR_CODES.INVALID_CREDENTIALS);
      }

      // Check if email is verified
      if (!user.emailVerified) {
        logger.warn('Login attempt with unverified email', {
          userId: user.id,
          email: email.toLowerCase(),
          ipAddress: getClientIP(req)
        });
        throw new UnauthorizedError(
          'Email not verified. Please verify your email to continue.',
          AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
          {
            userId: user.id,
            nextStep: 'verify-email',
            canResendOtp: true
          }
        );
      }

      // Check user status
      if (user.status !== 'ACTIVE') {
        logger.warn('Login attempt with inactive account', {
          userId: user.id,
          email: email.toLowerCase(),
          status: user.status,
          ipAddress: getClientIP(req)
        });
        throw new UnauthorizedError('Invalid email or password', AUTH_ERROR_CODES.INVALID_CREDENTIALS);
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, user.passwordHash);

      if (!isPasswordValid) {
        logger.warn('Login attempt with incorrect password', {
          userId: user.id,
          email: email.toLowerCase(),
          ipAddress: getClientIP(req)
        });
        throw new UnauthorizedError('Invalid email or password', AUTH_ERROR_CODES.INVALID_CREDENTIALS);
      }

      const userId = user.id.toString();

      // Generate tokens
      const accessToken = generateAccessToken(userId, user.email, 'USER');
      const refreshToken = generateRefreshToken(userId);
      const refreshTokenHash = await hashToken(refreshToken);

      // Calculate expiration
      const expiresAt = new Date(Date.now() + auth.refreshTokenExpirySeconds * 1000);

      // Store refresh token hash in database via Prisma
      await prisma.refreshToken.create({
        data: {
          userId: Number(userId),
          tokenHash: refreshTokenHash,
          expiresAt,
          ipAddress: getClientIP(req),
          userAgent: (req.headers['user-agent'] as string) || 'Unknown',
          deviceName: getDeviceName((req.headers['user-agent'] as string) || '')
        }
      });

      // Log successful login
      logger.info('User logged in', {
        userId,
        email: user.email,
        ipAddress: getClientIP(req)
      });

      // Update last login timestamp
      await prisma.user.update({
        where: { id: Number(userId) },
        data: { lastLoginAt: new Date() }
      });

      // Set auth cookies (access + refresh)
      setAccessTokenCookie(res, accessToken);
      setRefreshTokenCookie(res, refreshToken);

      // Return response
      return ok(res, {
        user: {
          id: userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      });
    } catch (error: any) {
      if (error instanceof BadRequestError || error instanceof UnauthorizedError) {
        throw error;
      }

      logger.error('Login failed', {
        email: email.toLowerCase(),
        error: error.message
      });

      throw new InternalServerError('Login failed');
    }
  } finally {
    logger.info('POST /api/auth/login end');
  }
});
