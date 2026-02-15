import { asyncHandler } from '../../utils/asyncHandler';
import { hashPassword } from '../../utils/password';
import { generateOtpCode, hashOtp } from '../../utils/otp';
import { isValidEmail, isValidPassword, isValidName, getClientIP, getDeviceName } from '../../utils/validation';
import { BadRequestError, ConflictError, InternalServerError } from '../../errors';
import { AUTH_ERROR_CODES } from '../../constants/errorCodes';
import { ok } from '../../utils/response';
import { prisma } from '../../db';
import logger from '../../utils/logger';
import { enqueueSendOtpEmailJob } from '../../queues/email-otp.queue';
import { createEmailVerificationToken } from '../../services/email-verification-redis.service';

/**
 * Register a new user account
 * POST /auth/register
 * 
 * Flow:
 * 1. Validate input
 * 2. Create or update unverified user
 * 3. Generate and send OTP
 * 4. Return user info (no tokens until verified)
 */
export const registerController = asyncHandler(async (req, res) => {
  logger.info('POST /api/auth/register start');
  try {
    console.log('Register controller invoked', req.body);
    const { email, password, confirmPassword, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      throw new BadRequestError('Email, password, confirm password, first name, and last name are required');
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

    if (password !== confirmPassword) {
      throw new BadRequestError('Password and confirm password do not match', {
        field: 'confirmPassword'
      });
    }

    if (!isValidName(firstName) || !isValidName(lastName)) {
      throw new BadRequestError('Names must be valid and not exceed 100 characters');
    }

    // Check if email already exists (email is the identity)
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        emailVerified: true,
        status: true
      }
    });

    try {
      // Hash password
      const passwordHash = await hashPassword(password);

      let userId: string;

      if (!existingUser) {
        // New registration: create unverified user in PENDING_VERIFICATION state
        const created = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            passwordHash,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            emailVerified: false,
            status: 'PENDING_VERIFICATION'
          }
        });

        userId = created.id.toString();
      } else {
        // Email exists
        if (existingUser.emailVerified) {
          // Already verified: block registration and prompt login
          throw new ConflictError(
            'Email already registered. Please log in.',
            AUTH_ERROR_CODES.EMAIL_ALREADY_VERIFIED,
            {
              field: 'email'
            }
          );
        }

        // Unverified user: treat as re-registration, update provisional details
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            status: 'PENDING_VERIFICATION'
          }
        });

        userId = existingUser.id.toString();
      }

      // Generate OTP and hash it for secure storage
      const otpCode = generateOtpCode();
      const otpCodeHash = await hashOtp(otpCode);

      // Create short-lived verification token in Redis with otpHash, userId, email, purpose
      const verificationToken = await createEmailVerificationToken(
        userId,
        email.toLowerCase(),
        otpCodeHash,
        'EMAIL_VERIFICATION'
      );

      // Enqueue OTP email job via BullMQ (event-based email sending)
      await enqueueSendOtpEmailJob({
        email: email.toLowerCase(),
        firstName,
        otpCode
      });

      // Log registration
      logger.info('User registered (awaiting email verification)', {
        userId,
        email: email.toLowerCase(),
        ipAddress: getClientIP(req)
      });

      // Return response (no tokens until verified, no userId exposed)
      return ok(
        res,
        {
          email: email.toLowerCase(),
          verificationToken
        },
        { statusCode: existingUser ? 200 : 201 }
      );
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
  } finally {
    logger.info('POST /api/auth/register end');
  }
});
