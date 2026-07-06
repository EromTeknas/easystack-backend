import { Request, Response, NextFunction } from "express";

import { AuthorizationScope } from "../configs/roles-registry.config";
import { AuthorizationService } from "../services/authorization.service";
import { ForbiddenError } from "../../../errors";

interface AuthorizeOptions {
  scope: AuthorizationScope;

  permission: string;

  scopeId: (req: Request) => string;
}

export function authorize({
  scope,
  permission,
  scopeId,
}: AuthorizeOptions) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
    const userId = req.user?.id;
    const resolvedScopeId = scopeId(req);

    const allowed = await AuthorizationService.can(
      userId!.toString(),
      permission,
      scope,
      scopeId(req),
    );

    if (!allowed) {
        // Throw your custom AppError with helpful debug metadata
        throw new ForbiddenError(
          `You do not have permission to perform this action on this ${scope}.`,
          "INSUFFICIENT_PERMISSIONS", 
          { 
            requiredPermission: permission, 
            scope, 
            scopeId: resolvedScopeId, 
          }
        );
      }

      next();
    } catch (error) {
      // Pass the error to the global errorHandlerMiddleware
      next(error);
    }
  };
}