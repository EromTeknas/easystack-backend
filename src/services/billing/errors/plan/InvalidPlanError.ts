import { BillingError } from "../../BillingError";
import { BillingErrorCode } from "../../BillingErrorCode";

export class InvalidPlanError extends BillingError {
  readonly code = BillingErrorCode.INVALID_PLAN;
  readonly statusCode = 400;

  constructor(planKey: string) {
    super({
      message: `Plan '${planKey}' is invalid.`,
      metadata: {
        planKey,
      },
    });
  }
}