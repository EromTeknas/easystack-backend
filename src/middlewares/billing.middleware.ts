import { NextFunction, Response } from "express";
import { BillingService } from "../services/billing.service";
import { ForbiddenError, UnauthorizedError } from "../errors";

export function requireSubscription() {
  return async (req: any, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError("Unauthorized");
      }

      const subscription = await BillingService.subscription(req.user.id);

      if (!subscription) {
        throw new ForbiddenError("Subscription required", "SUBSCRIPTION_REQUIRED");
      }

      if (!["ACTIVE", "TRIAL"].includes(subscription.status)) {
        throw new ForbiddenError("Subscription is not active", "SUBSCRIPTION_INACTIVE");
      }

      req.billing = req.billing ?? {};
      req.billing.subscription = subscription;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireFeature(featureKey: string) {
  return async (req: any, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError("Unauthorized");
      }

      const allowed = await BillingService.hasFeature(req.user.id, featureKey);

      if (!allowed) {
        throw new ForbiddenError(`Feature '${featureKey}' is not available`, "FEATURE_NOT_AVAILABLE", {
          featureKey,
        });
      }

      req.billing = req.billing ?? {};
      req.billing.features = req.billing.features ?? {};
      req.billing.features[featureKey] = true;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireQuota(quotaKey: string, amount: number = 1) {
  return async (req: any, _res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError("Unauthorized");
      }

      const check = await BillingService.canPerformAction(req.user.id, quotaKey);

      if (!check.allowed || (check.remaining !== null && check.remaining < amount)) {
        throw new ForbiddenError(`Quota exceeded for ${quotaKey}`, "QUOTA_EXCEEDED", {
          quotaKey,
          limit: check.limit,
          used: check.used,
          remaining: check.remaining,
          amount,
        });
      }

      req.billing = req.billing ?? {};
      req.billing.quota = {
        quotaKey,
        amount,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

export const billingGuard = requireQuota;
export const featureGuard = requireFeature;
