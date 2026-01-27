import { asyncHandler } from '../../utils/asyncHandler';
import { verifyPassword, hashToken } from '../../utils/password';
import { generateAccessToken, generateRefreshToken, getTokenExpiryInSeconds } from '../../utils/jwt';
import { isValidEmail, getClientIP, getDeviceName } from '../../utils/validation';
import { BadRequestError, UnauthorizedError, InternalServerError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';
import { auth } from '../../config/auth';

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
    const [[user]] = (await db.query(
      'SELECT id, email, password_hash, email_verified, status, first_name, last_name FROM users WHERE email = ?',
      [email.toLowerCase()]
    )) as any[];

    if (!user) {
      logger.warn('Login attempt with non-existent email', {
        email: email.toLowerCase(),
        ipAddress: getClientIP(req)
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if email is verified
    if (!user.email_verified) {
      logger.warn('Login attempt with unverified email', {
        userId: user.id,
        email: email.toLowerCase(),
        ipAddress: getClientIP(req)
      });
      throw new UnauthorizedError('Please verify your email before logging in', {
        code: 'EMAIL_NOT_VERIFIED',
        userId: user.id
      });
    }

    // Check user status
    if (user.status !== 'active') {
      logger.warn('Login attempt with inactive account', {
        userId: user.id,
        email: email.toLowerCase(),
        status: user.status,
        ipAddress: getClientIP(req)
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      logger.warn('Login attempt with incorrect password', {
        userId: user.id,
        email: email.toLowerCase(),
        ipAddress: getClientIP(req)
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    const userId = user.id.toString();

    // Generate tokens
    const accessToken = generateAccessToken(userId, user.email, 'USER');
    const refreshToken = generateRefreshToken(userId);
    const refreshTokenHash = await hashToken(refreshToken);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + auth.refreshTokenExpirySeconds * 1000);

    // Store refresh token hash in database
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent, device_name) VALUES (?, ?, ?, ?, ?, ?)',
      [
        userId,
        refreshTokenHash,
        expiresAt,
        getClientIP(req),
        req.headers['user-agent'] || 'Unknown',
        getDeviceName(req.headers['user-agent'] || '')
      ]
    );

    // Log successful login
    logger.info('User logged in', {
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

    // Return response
    res.json({
      success: true,
      data: {
        user: {
          id: userId,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name
        },
        accessToken,
        expiresIn: getTokenExpiryInSeconds(accessToken)
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
});
