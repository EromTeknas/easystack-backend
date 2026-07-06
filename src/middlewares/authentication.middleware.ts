import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { auth } from '../config/auth';

/**
 * Middleware to authenticate requests using JWT access token
 * Verifies token from HttpOnly access token cookie
 */
export const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[auth.cookies.accessTokenName];

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = verifyAccessToken(token);

    // Attach user info to request
    req.user = {
      id: decoded.sub
    };

    next();
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else if (error.message === 'Token expired') {
      next(new UnauthorizedError('Token expired'));
    } else if (error.message === 'Invalid token') {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(new UnauthorizedError('Authentication failed'));
    }
  }
};

// Export alias for consistency
export const authenticate = authenticateToken;

/**
 * Middleware to check if user is authenticated (optional)
 * Does not throw error if not authenticated, just skips setting req.user
 */
export const optionalAuth = (req: any, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[auth.cookies.accessTokenName];

    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = {
        id: decoded.sub
      };
    }
  } catch {
    // Silently fail, user is optional
  }

  next();
};
