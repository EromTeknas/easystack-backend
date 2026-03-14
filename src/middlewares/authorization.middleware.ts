/**
 * Authorization Middleware
 * Role-Based Access Control (RBAC) for workspace operations
 * 
 * Usage:
 *   router.get('/workspace/:workspaceId/settings', authorize(['OWNER', 'ADMIN']), controllerFn)
 */

import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors';
import { getUserWorkspaceRole } from '../services/workspace.service';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      workspaceId?: number;
      userRole?: string;
    }
  }
}

/**
 * Authorize request based on workspace roles
 * 
 * @param allowedRoles - Array of roles that can access this endpoint
 * @returns Middleware function
 */
export function authorize(allowedRoles: ('OWNER' | 'ADMIN')[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get workspace ID from params or body
      let workspaceId = req.params.workspaceId || req.body.workspaceId;
      
      // Convert to number if it's a string
      if (typeof workspaceId === 'string') {
        workspaceId = parseInt(workspaceId, 10);
      }
      
      const userId = Number(req.userId);

      if (!userId) {
        throw new ForbiddenError('Authentication required');
      }

      if (!workspaceId) {
        throw new ForbiddenError('Workspace ID required');
      }

      // Get user's role in workspace
      const userRole = await getUserWorkspaceRole(workspaceId, userId);

      if (!userRole) {
        logger.warn('Access attempt to unauthorized workspace', {
          userId,
          workspaceId
        });
        throw new ForbiddenError('You do not have access to this workspace');
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(userRole as any)) {
        logger.warn('Insufficient permissions for workspace operation', {
          userId,
          workspaceId,
          userRole,
          requiredRoles: allowedRoles
        });
        throw new ForbiddenError(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`
        );
      }

      // Attach role to request for use in controllers
      req.userRole = userRole;
      req.workspaceId = workspaceId;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Authorize only workspace owners
 */
export function authorizeOwner(req: Request, res: Response, next: NextFunction) {
  return authorize(['OWNER'])(req, res, next);
}

/**
 * Authorize owners and admins
 */
export function authorizeAdmin(req: Request, res: Response, next: NextFunction) {
  return authorize(['OWNER', 'ADMIN'])(req, res, next);
}
