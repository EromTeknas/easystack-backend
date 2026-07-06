import { BillingError } from "./BillingError";
import { BillingErrorCode } from "./BillingErrorCode";

export class QuotaNotFoundError extends BillingError {
  constructor(quotaKey: string) {
    super(`Quota '${quotaKey}' does not exist.`, 404, BillingErrorCode.QUOTA_NOT_FOUND, { quotaKey });
  }
}

export class InvalidQuotaError extends BillingError {
  constructor(quotaKey: string) {
    super(`Quota '${quotaKey}' is invalid.`, 400, BillingErrorCode.INVALID_QUOTA, { quotaKey });
  }
}

export class QuotaExceededError extends BillingError {
  constructor(quotaKey: string, limit: number, usage: number, requested = 1) {
    super(
      `Quota '${quotaKey}' has been exceeded.`, 
      429, 
      BillingErrorCode.QUOTA_EXCEEDED, 
      { quotaKey, limit, usage, requested, remaining: Math.max(limit - usage, 0) }
    );
  }
}