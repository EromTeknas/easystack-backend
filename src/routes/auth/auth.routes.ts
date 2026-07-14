import { Router } from 'express';
import { registerController } from './register.controller';
import { loginController } from './login.controller';
import { refreshController } from './refresh.controller';
import { logoutController } from './logout.controller';
import { getMeController } from './me.controller';
import { verifyEmailController } from './verify-email.controller';
import { resendOtpController } from './resend-otp.controller';
import { forgotPasswordController } from './forgot-password.controller';
import { resetPasswordController } from './reset-password.controller';
import { authRateLimiter } from '../../middlewares/rateLimit.middleware';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import { googleLoginController, linkGoogleController } from './provider.controller';

const router = Router();

/**
 * POST /auth/register
 * Register a new user account
 * Public endpoint
 * 
 * Body:
 *   - email (string)
 *   - password (string, min 12 chars, uppercase, lowercase, number, special char)
 *   - firstName (string)
 *   - lastName (string)
 * 
 * Response:
 *   - userId
 *   - email
 *   - firstName
 *   - lastName
 *   - message: "Registration successful. Please verify your email to continue."
 *   - nextStep: "verify-email"
 */
router.post('/register', authRateLimiter, registerController);

/**
 * POST /auth/verify-email
 * Verify user's email with OTP
 * Public endpoint (no auth required)
 * 
 * Body:
 *   - userId (string)
 *   - otpCode (string, 6 digits)
 * 
 * Response:
 *   - user object
 *   - Cookies: accessToken, refreshToken (HttpOnly)
 */
router.post('/verify-email', authRateLimiter, verifyEmailController);

/**
 * POST /auth/resend-otp
 * Resend OTP to user's email
 * Public endpoint (no auth required)
 * 
 * Body:
 *   - userId (string)
 * 
 * Response:
 *   - message
 *   - email
 */
router.post('/resend-otp', authRateLimiter, resendOtpController);

/**
 * POST /auth/forgot-password
 * Initiate password reset flow (email must be verified)
 *
 * Body:
 *   - email (string)
 *
 * Behavior:
 *   - If user missing: generic success
 *   - If unverified: block reset, resend verification OTP
 *   - If verified: generic success (reset email handling can be implemented separately)
 */
router.post('/forgot-password', authRateLimiter, forgotPasswordController);

/**
 * POST /auth/reset-password
 * Complete password reset flow using a one-time token
 *
 * Body:
 *   - userId (string)
 *   - token (string)
 *   - password (string)
 *   - confirmPassword (string)
 */
router.post('/reset-password', authRateLimiter, resetPasswordController);

/**
 * POST /auth/login
 * Authenticate user and establish session
 * Public endpoint
 * 
 * Requirements:
 *   - Email must be verified
 *   - Password must match
 * 
 * Body:
 *   - email (string)
 *   - password (string)
 * 
 * Response:
 *   - user object
 *   - Cookies: accessToken, refreshToken (HttpOnly)
 */
router.post('/login', authRateLimiter, loginController);

router.post('/providers/google', authRateLimiter, googleLoginController);

router.post('/providers/google/link', authenticate, linkGoogleController);

/**
 * POST /auth/refresh
 * Obtain new access token using refresh token
 * Public endpoint (no auth required, uses cookie)
 * 
 * Features:
 *   - Token rotation enabled
 *   - Old refresh token is revoked
 *   - New refresh token is issued
 * 
 * Response:
 *   - user object
 *   - Cookies: accessToken, refreshToken (HttpOnly)
 */
router.post('/refresh', refreshController);

/**
 * POST /auth/logout
 * Revoke refresh token and end session
 * Public endpoint (works with or without auth)
 * 
 * Response:
 *   - message: "Logout successful"
 */
router.post('/logout', logoutController);

/**
 * GET /auth/me
 * Get current authenticated user
 * Protected endpoint (uses access token cookie)
 * 
 * Response:
 *   - user object with workspaces
 */
router.get('/me', getMeController);

export default router;
