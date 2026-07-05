import { BillingError } from "../BillingError";
import { BillingErrorCode } from "../BillingErrorCode";

export class QuotaExceededError extends BillingError {
  readonly code = BillingErrorCode.QUOTA_EXCEEDED;
  readonly statusCode = 429;

  constructor(
    quotaKey: string,
    limit: number,
    usage: number,
    requested = 1
  ) {
    super({
      message: `Quota '${quotaKey}' has been exceeded.`,
      metadata: {
        quotaKey,
        limit,
        usage,
        requested,
        remaining: Math.max(limit - usage, 0),
      },
    });
  }
}