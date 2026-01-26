import { Router } from 'express';
import { registerController } from './register.controller';
import { loginController } from './login.controller';
import { refreshController } from './refresh.controller';
import { logoutController, getMeController } from './logout-me.controller';
import { authRateLimiter } from '../../middlewares/rateLimit.middleware';
import { authenticateToken } from '../../middlewares/authentication.middleware';

const router = Router();

/**
 * POST /auth/register
 * Register a new user account
 * Public endpoint
 */
router.post('/register', authRateLimiter, registerController);

/**
 * POST /auth/login
 * Authenticate user and establish session
 * Public endpoint
 */
router.post('/login', authRateLimiter, loginController);

/**
 * POST /auth/refresh
 * Obtain new access token using refresh token cookie
 * Public endpoint (no auth required)
 */
router.post('/refresh', refreshController);

/**
 * POST /auth/logout
 * Revoke refresh token and end session
 * Public endpoint (works with or without auth)
 */
router.post('/logout', logoutController);

/**
 * GET /auth/me
 * Get current authenticated user
 * Protected endpoint (requires valid access token)
 */
router.get('/me', authenticateToken, getMeController);

export default router;
