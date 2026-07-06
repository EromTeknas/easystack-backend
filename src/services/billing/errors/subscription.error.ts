import { BillingError } from "./BillingError";
import { BillingErrorCode } from "./BillingErrorCode";

export class SubscriptionRequiredError extends BillingError {
  constructor() {
    super("An active subscription is required.", 402, BillingErrorCode.SUBSCRIPTION_REQUIRED);
  }
}

export class TrialExpiredError extends BillingError {
  constructor() {
    super("Trial period has expired.", 402, BillingErrorCode.TRIAL_EXPIRED);
  }
}

export class SubscriptionNotFoundError extends BillingError {
  constructor(userId: number) {
    super(`Subscription not found for user '${userId}'.`, 404, BillingErrorCode.SUBSCRIPTION_NOT_FOUND, { userId });
  }
}

export class SubscriptionExpiredError extends BillingError {
  constructor(expiresAt?: Date) {
    super("Subscription has expired.", 402, BillingErrorCode.SUBSCRIPTION_EXPIRED, { expiresAt });
  }
}