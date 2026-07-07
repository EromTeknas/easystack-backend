import {
  Request,
  Response,
  NextFunction,
} from "express";

import { BillingService } from "../../services/billing.service";
import { BillingAuthorizationService } from "../../services/billing-authorization.service";
import { BadRequestError } from "../../../../errors";

import {
  BillingAuthorizationRequest,
} from "../../types";

export function billingMiddleware(
  getWorkspaceId: (req: Request) => number,
  request: BillingAuthorizationRequest
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {

    try {
      const workspaceId = getWorkspaceId(req);

      if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
        throw new BadRequestError("workspaceId is required and must be a positive number");
      }

      if (req.user?.id) {
        await BillingAuthorizationService.ensureWorkspaceMember(
          Number(req.user.id),
          workspaceId,
        );
      }

      const shouldConsume =
        request.quotas?.some((quota) => quota.consume) ?? false;

      const result =
        shouldConsume
          ? await BillingService.authorizeAndConsume(
              workspaceId,
              request
            )
          : await BillingService.authorize(
              workspaceId,
              request
            );

      req.billing = result;

      next();

    } catch (error) {
      next(error);
    }
  };
}
