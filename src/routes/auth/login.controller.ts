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
import { randomUUID } from 'node:crypto';
import { BillingService } from '../../services/billing.service';

/**
 * Login with email and password (transactional)
 * POST /auth/login
 * 
 * Atomically stores refresh token and updates last login
 * If any step fails, all changes are rolled back
 *
 * Requirements:
 * - Email must be verified before login
 * - Password must match
 * - Account must be active
 */
export const loginController = asyncHandler(async (req, res) => {
  logger.info('POST /api/auth/login start');
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    throw new BadRequestError('Email and password are required');
  }

  if (!isValidEmail(email)) {
    throw new BadRequestError('Invalid email format');
  }

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
      lastName: true,
      onboardingCompleted: true,
      defaultWorkspaceId: true,
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
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  const refreshTokenHash = await hashToken(refreshToken);
  const familyId = randomUUID(); // Unique identifier for this refresh token family

  // Calculate expiration
  const expiresAt = new Date(Date.now() + auth.refreshTokenExpirySeconds * 1000);

  // Transactional: Store refresh token + update last login
  await prisma.$transaction(async (tx) => {
    // Step 1: Create refresh token record
    await tx.refreshToken.create({
      data: {
        userId: Number(userId),
        tokenHash: refreshTokenHash,
        expiresAt,
        ipAddress: getClientIP(req),
        userAgent: (req.headers['user-agent'] as string) || 'Unknown',
        deviceName: getDeviceName((req.headers['user-agent'] as string) || ''),
        familyId
      }
    });

    logger.info('Refresh token stored in transaction', { userId });

    // Step 2: Update last login timestamp
    await tx.user.update({
      where: { id: Number(userId) },
      data: { lastLoginAt: new Date() }
    });

    logger.info('Last login updated in transaction', { userId });
  });

  // Log successful login
  logger.info('User logged in', {
    userId,
    email: user.email,
    ipAddress: getClientIP(req)
  });

  // Set auth cookies (access + refresh)
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);

  // Fire-and-forget cache warm-up. 
  // No need to 'await' it; let it run in the background so it doesn't slow down the login response.
  if (user.defaultWorkspaceId) {
    BillingService.get(user.defaultWorkspaceId).catch((err) => 
      logger.error('Failed to warm billing cache post-login', { userId, workspaceId: user.defaultWorkspaceId, error: err.message })
    );
  }
  
  // Return response
  return ok(res, {
    user: {
      id: userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      onboardingCompleted: user.onboardingCompleted
    }
  });
});
