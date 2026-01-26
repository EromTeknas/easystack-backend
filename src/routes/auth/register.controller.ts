import { asyncHandler } from '../../utils/asyncHandler';
import { hashPassword, hashToken } from '../../utils/password';
import { generateAccessToken, generateRefreshToken, getTokenExpiryInSeconds } from '../../utils/jwt';
import { isValidEmail, isValidPassword, isValidName, getClientIP, getDeviceName } from '../../utils/validation';
import { BadRequestError, ConflictError, InternalServerError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';

/**
 * Register a new user account
 * POST /auth/register
 */
export const registerController = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  // Validate input
  if (!email || !password || !firstName || !lastName) {
    throw new BadRequestError('Email, password, first name, and last name are required');
  }

  if (!isValidEmail(email)) {
    throw new BadRequestError('Invalid email format', { field: 'email' });
  }

  if (!isValidPassword(password)) {
    throw new BadRequestError('Password does not meet requirements', {
      field: 'password',
      requirements: [
        'At least 12 characters',
        'At least one uppercase letter',
        'At least one lowercase letter',
        'At least one number',
        'At least one special character'
      ]
    });
  }

  if (!isValidName(firstName) || !isValidName(lastName)) {
    throw new BadRequestError('Names must be valid and not exceed 100 characters');
  }

  // Check if email already exists
  const [[existingUser]] = (await db.query(
    'SELECT id FROM users WHERE email = ?',
    [email.toLowerCase()]
  )) as any[];

  if (existingUser) {
    throw new ConflictError('Email already registered', { field: 'email' });
  }

  try {
    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [email.toLowerCase(), passwordHash, firstName.trim(), lastName.trim(), 'USER', 'active']
    ) as any;

    const userId = result.insertId.toString();

    // Generate tokens
    const accessToken = generateAccessToken(userId, email.toLowerCase(), 'USER');
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

    // Log registration
    logger.info('User registered', {
      userId,
      email: email.toLowerCase(),
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
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: userId,
          email: email.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          role: 'USER'
        },
        accessToken,
        expiresIn: getTokenExpiryInSeconds(accessToken)
      }
    });
  } catch (error: any) {
    logger.error('Registration failed', {
      email: email.toLowerCase(),
      error: error.message
    });

    if (error instanceof BadRequestError || error instanceof ConflictError) {
      throw error;
    }

    throw new InternalServerError('Registration failed');
  }
});
