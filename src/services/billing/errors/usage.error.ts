import { BillingError } from "./BillingError";
import { BillingErrorCode } from "./BillingErrorCode";

export class UsageSyncError extends BillingError {
  constructor(cause?: unknown) {
    super("Failed to synchronize usage with the database.", 500, BillingErrorCode.USAGE_SYNC_FAILED, { cause });
  }
}