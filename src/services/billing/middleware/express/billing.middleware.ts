import {
  Request,
  Response,
  NextFunction,
} from "express";

import { BillingService } from "../../services/billing.service";

import {
  BillingAuthorizationRequest,
} from "../../types";

export function billingMiddleware(
  getUserId: (req: Request) => number,
  request: BillingAuthorizationRequest
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {

    try {

      const shouldConsume =
        request.quotas?.some((quota) => quota.consume) ?? false;

      const result =
        shouldConsume
          ? await BillingService.authorizeAndConsume(
              getUserId(req),
              request
            )
          : await BillingService.authorize(
              getUserId(req),
              request
            );

      req.billing = result;

      next();

    } catch (error) {
      next(error);
    }
  };
}