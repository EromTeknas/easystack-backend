import { BillingError } from "../BillingError";
import { BillingErrorCode } from "../BillingErrorCode";

export class SubscriptionRequiredError extends BillingError {
  readonly code = BillingErrorCode.SUBSCRIPTION_REQUIRED;
  readonly statusCode = 402;

  constructor() {
    super({
      message: "An active subscription is required.",
    });
  }
}