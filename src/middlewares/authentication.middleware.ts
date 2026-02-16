import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../errors';

/**
 * Middleware to authenticate requests using JWT access token
 * Verifies token from Authorization header
 */
export const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = verifyAccessToken(token);

    // Attach user info to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role
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

/**
 * Middleware to authorize requests based on user role
 * Usage: authorize('ADMIN', 'MODERATOR')
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Not authenticated');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError('Insufficient permissions for this action');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Export alias for consistency
export const authenticate = authenticateToken;

/**
 * Middleware to check if user is authenticated (optional)
 * Does not throw error if not authenticated, just skips setting req.user
 */
export const optionalAuth = (req: any, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role
      };
    }
  } catch {
    // Silently fail, user is optional
  }

  next();
};
