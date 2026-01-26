import { asyncHandler } from '../../utils/asyncHandler';
import { verifyPassword, hashToken } from '../../utils/password';
import { generateAccessToken, generateRefreshToken, getTokenExpiryInSeconds } from '../../utils/jwt';
import { isValidEmail, getClientIP, getDeviceName } from '../../utils/validation';
import { BadRequestError, UnauthorizedError, InternalServerError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';

/**
 * Login with email and password
 * POST /auth/login
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
      'SELECT id, email, password_hash, role, status, first_name, last_name FROM users WHERE email = ?',
      [email.toLowerCase()]
    )) as any[];

    if (!user) {
      logger.warn('Login attempt with non-existent email', {
        email: email.toLowerCase(),
        ipAddress: getClientIP(req)
      });
      throw new UnauthorizedError('Invalid email or password');
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
    const accessToken = generateAccessToken(userId, user.email, user.role);
    const refreshToken = generateRefreshToken(userId);
    const refreshTokenHash = await hashToken(refreshToken);

    // Calculate expiration
    const expiresInSeconds = 7 * 24 * 60 * 60; // 7 days
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

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

    // Update last login time
    await db.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [userId]
    );

    // Log successful login
    logger.info('User logged in', {
      userId,
      email: user.email,
      ipAddress: getClientIP(req)
    });

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: expiresInSeconds * 1000
    });

    // Return response
    res.json({
      success: true,
      data: {
        user: {
          id: userId,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
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
