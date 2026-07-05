import { BillingError } from "../BillingError";
import { BillingErrorCode } from "../BillingErrorCode";

export class UsageSyncError extends BillingError {
  readonly code = BillingErrorCode.USAGE_SYNC_FAILED;
  readonly statusCode = 500;

  constructor(cause?: unknown) {
    super({
      message: "Failed to synchronize usage with the database.",
      cause,
    });
  }
}