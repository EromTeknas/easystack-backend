import { BillingError } from "../BillingError";
import { BillingErrorCode } from "../BillingErrorCode";

export class QuotaNotFoundError extends BillingError {
  readonly code = BillingErrorCode.QUOTA_NOT_FOUND;
  readonly statusCode = 404;

  constructor(quotaKey: string) {
    super({
      message: `Quota '${quotaKey}' does not exist.`,
      metadata: {
        quotaKey,
      },
    });
  }
}