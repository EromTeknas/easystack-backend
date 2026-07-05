import { BillingError } from "../BillingError";
import { BillingErrorCode } from "../BillingErrorCode";

export class TrialExpiredError extends BillingError {
  readonly code = BillingErrorCode.TRIAL_EXPIRED;
  readonly statusCode = 402;

  constructor() {
    super({
      message: "Trial period has expired.",
    });
  }
}