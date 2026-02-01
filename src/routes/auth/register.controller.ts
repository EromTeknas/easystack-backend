import { asyncHandler } from '../../utils/asyncHandler';
import { hashPassword } from '../../utils/password';
import { generateOtpCode, hashOtp } from '../../utils/otp';
import { isValidEmail, isValidPassword, isValidName, getClientIP, getDeviceName } from '../../utils/validation';
import { BadRequestError, ConflictError, InternalServerError } from '../../errors';
import { db } from '../../db';
import logger from '../../utils/logger';
import { storeUserOtp } from '../../services/otp-redis.service';
import { enqueueSendOtpEmailJob } from '../../queues/email-otp.queue';
import { createDefaultWorkspace, addWorkspaceMember } from '../../services/workspace.service';

/**
 * Register a new user account
 * POST /auth/register
 * 
 * Flow:
 * 1. Validate input
 * 2. Create unverified user
 * 3. Generate and send OTP
 * 4. Create default workspace
 * 5. Return user info (no tokens until verified)
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

    // Create unverified user
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, email_verified, status) VALUES (?, ?, ?, ?, ?, ?)',
      [email.toLowerCase(), passwordHash, firstName.trim(), lastName.trim(), false, 'active']
    ) as any;

    const userId = result.insertId.toString();

    // Generate OTP
    const otpCode = generateOtpCode();
    const otpCodeHash = await hashOtp(otpCode);

    // Store OTP in Redis with TTL
    await storeUserOtp(userId, otpCodeHash);

    // Enqueue OTP email job via BullMQ (event-based email sending)
    await enqueueSendOtpEmailJob({
      email: email.toLowerCase(),
      firstName,
      otpCode
    });

    // Create default workspace
    const workspaceId = await createDefaultWorkspace(userId);
    await addWorkspaceMember(workspaceId, userId, 'OWNER');

    // Log registration
    logger.info('User registered (awaiting email verification)', {
      userId,
      email: email.toLowerCase(),
      ipAddress: getClientIP(req)
    });

    // Return response (no tokens until verified)
    res.status(201).json({
      success: true,
      data: {
        userId,
        email: email.toLowerCase(),
        firstName,
        lastName,
        message: 'Registration successful. Please verify your email to continue.',
        nextStep: 'verify-email'
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
