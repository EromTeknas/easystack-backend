import {
  Request,
  Response,
  NextFunction,
} from "express";

import { BillingService } from "../../services/billing.service";

import {
  BillingAuthorizationRequest,
} from "../../types";

import {
  BillingError,
} from "../../errors";

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

      const result =
        await BillingService.authorize(
          getUserId(req),
          request
        );

      req.billing = result;

      next();

    } catch (error) {

      if (
        error instanceof BillingError
      ) {
        return res
          .status(error.statusCode)
          .json(error.serialize());
      }

      next(error);
    }
  };
}