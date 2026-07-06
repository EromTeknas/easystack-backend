import { SubscriptionStatus } from "@prisma/client";

import { BillingCache } from "../types/billing-cache.type.ts";
import { BillingAuthorizationRequest } from "../types/billing-authorization.type.ts";
import { SubscriptionExpiredError, SubscriptionRequiredError, TrialExpiredError } from "../errors/index.ts";

export class SubscriptionValidator {
  static validate(cache: BillingCache, request: BillingAuthorizationRequest): void {
    if (request.subscription) {
      if (!cache.subscription) {
        throw new SubscriptionRequiredError();
      }

      if (cache.subscription.status !== SubscriptionStatus.ACTIVE && cache.subscription.status !== SubscriptionStatus.TRIAL) {
        throw new SubscriptionExpiredError(
          cache.subscription.expiresAt ? new Date(cache.subscription.expiresAt) : undefined,
        );
      }
    }

    if (request.paidSubscription) {
      if (!cache.subscription) {
        throw new SubscriptionRequiredError();
      }

      if (cache.subscription.status === SubscriptionStatus.TRIAL) {
        throw new TrialExpiredError();
      }

      if (cache.subscription.status !== SubscriptionStatus.ACTIVE) {
        throw new SubscriptionRequiredError();
      }
    }
  }
}