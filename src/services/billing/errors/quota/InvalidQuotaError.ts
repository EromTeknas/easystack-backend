import { BillingError } from "../BillingError";
import { BillingErrorCode } from "../BillingErrorCode";

export class InvalidQuotaError extends BillingError {
  readonly code = BillingErrorCode.INVALID_QUOTA;
  readonly statusCode = 400;

  constructor(quotaKey: string) {
    super({
      message: `Quota '${quotaKey}' is invalid.`,
      metadata: {
        quotaKey,
      },
    });
  }
}