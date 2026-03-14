import { NextFunction, Response } from 'express';
import { getUserWorkspaceRole } from '../services/workspace.service';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '../errors';

export type WorkspaceGuardOptions = {
  roles?: Array<'OWNER' | 'ADMIN' | 'DEVELOPER' | 'PUBLISHER'>;
  workspaceIdParam?: string;
};

const resolveWorkspaceId = (req: any, paramName: string): number | null => {
  const fromParams = req?.params?.[paramName];
  if (typeof fromParams === 'string' && fromParams.trim().length > 0) {
    const parsed = parseInt(fromParams.trim(), 10);
    if (!isNaN(parsed)) return parsed;
  }

  const fromBody = req?.body?.workspaceId;
  if (typeof fromBody === 'number') {
    return fromBody;
  }
  if (typeof fromBody === 'string' && fromBody.trim().length > 0) {
    const parsed = parseInt(fromBody.trim(), 10);
    if (!isNaN(parsed)) return parsed;
  }

  const fromQuery = req?.query?.workspaceId;
  if (typeof fromQuery === 'string' && fromQuery.trim().length > 0) {
    const parsed = parseInt(fromQuery.trim(), 10);
    if (!isNaN(parsed)) return parsed;
  }

  return null;
};

/**
 * Workspace guard middleware
 * Ensures the authenticated user is a member of the workspace
 * Optionally enforces role-based access within the workspace
 */
export const workspaceGuard = (options?: WorkspaceGuardOptions) => {
  return async (req: any, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('Not authenticated');
      }

      const workspaceId = resolveWorkspaceId(req, options?.workspaceIdParam ?? 'workspaceId');

      if (!workspaceId) {
        throw new BadRequestError('workspaceId is required');
      }

      const role = await getUserWorkspaceRole(workspaceId, Number(req.user.id));

      if (!role) {
        throw new ForbiddenError('You do not have access to this workspace');
      }

      if (options?.roles?.length && !options.roles.includes(role)) {
        throw new ForbiddenError('Insufficient workspace permissions');
      }

      req.workspace = {
        id: workspaceId,
        role
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};
