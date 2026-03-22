/**
 * Project Authorization Middleware
 * Checks user permissions on specific project actions
 *
 * Usage in routes:
 * router.post('/projects/:projectId/models', 
 *   requireProjectPermission(ProjectPermissionAction.MODEL_CREATE),
 *   createModelController
 * );
 */

import { Response, NextFunction } from 'express';
import { authorizationService } from '../services/authorization.service';
import { ProjectPermissionAction } from '../constants/projectRoles';
import { ForbiddenError } from '../errors';
import logger from '../utils/logger';

/**
 * Middleware factory to require a specific project permission
 * Extracts projectId from req.params and checks user permission
 */
export function requireProjectPermission(action: ProjectPermissionAction) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = Number(req.user?.id);
      const projectId = Number(req.params.projectId);

      if (!userId || !projectId) {
        throw new ForbiddenError('Invalid request: userId or projectId missing');
      }

      // Check permission
      const result = await authorizationService.getProjectPermission(userId, projectId, action);

      if (!result.allowed) {
        logger.warn('Project permission denied', {
          userId: userId.toString(),
          projectId: projectId.toString(),
          action,
          reason: result.reason,
          requestId: req.requestId,
        });
        throw new ForbiddenError(`Permission denied: ${action}`);
      }

      // Store permission resolution in request for logging/debugging
      req.permissionResolution = result;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Attach project permissions to request for template rendering or API response
 * Useful for frontend to determine UI capabilities
 */
export async function attachProjectPermissions(req: any, res: Response, next: NextFunction) {
  try {
    const userId = Number(req.user?.id);
    const projectId = Number(req.params.projectId);

    if (userId && projectId) {
      const permissions = await authorizationService.getProjectEffectivePermissions(
        userId,
        projectId
      );
      req.projectPermissions = Array.from(permissions);
    }

    next();
  } catch (error) {
    // Silently continue if permission check fails
    next();
  }
}
