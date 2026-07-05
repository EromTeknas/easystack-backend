import { BillingError } from "../BillingError";
import { BillingErrorCode } from "../BillingErrorCode";

export class SubscriptionExpiredError extends BillingError {
  readonly code = BillingErrorCode.SUBSCRIPTION_EXPIRED;
  readonly statusCode = 402;

  constructor(expiresAt?: Date) {
    super({
      message: "Subscription has expired.",
      metadata: {
        expiresAt,
      },
    });
  }
}