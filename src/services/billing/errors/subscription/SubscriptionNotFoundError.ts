import { BillingError } from "../BillingError";
import { BillingErrorCode } from "../BillingErrorCode";

export class SubscriptionNotFoundError extends BillingError {
  readonly code = BillingErrorCode.SUBSCRIPTION_NOT_FOUND;
  readonly statusCode = 404;

  constructor(userId: number) {
    super({
      message: `Subscription not found for user '${userId}'.`,
      metadata: {
        userId,
      },
    });
  }
}