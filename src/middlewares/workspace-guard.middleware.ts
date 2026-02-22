import { NextFunction, Response } from 'express';
import { getUserWorkspaceRole } from '../services/workspace.service';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '../errors';

export type WorkspaceGuardOptions = {
  roles?: Array<'OWNER' | 'ADMIN' | 'DEVELOPER' | 'PUBLISHER'>;
  workspaceIdParam?: string;
};

const resolveWorkspaceId = (req: any, paramName: string): string | null => {
  const fromParams = req?.params?.[paramName];
  if (typeof fromParams === 'string' && fromParams.trim().length > 0) {
    return fromParams.trim();
  }

  const fromBody = req?.body?.workspaceId;
  if (typeof fromBody === 'string' && fromBody.trim().length > 0) {
    return fromBody.trim();
  }

  const fromQuery = req?.query?.workspaceId;
  if (typeof fromQuery === 'string' && fromQuery.trim().length > 0) {
    return fromQuery.trim();
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
