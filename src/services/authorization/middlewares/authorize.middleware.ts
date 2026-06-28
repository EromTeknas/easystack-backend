import { Request, Response, NextFunction } from "express";

import { AuthorizationScope } from "../configs/roles-registry.config";
import { AuthorizationService } from "../services/authorization.service";

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
    const userId = req?.user?.id;

    const allowed = await AuthorizationService.can(
      userId!.toString(),
      permission,
      scope,
      scopeId(req),
    );

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    next();
  };
}