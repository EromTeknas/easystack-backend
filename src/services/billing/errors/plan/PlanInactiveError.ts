import { BillingError } from "../BillingError";
import { BillingErrorCode } from "../BillingErrorCode";

export class PlanInactiveError extends BillingError {
  readonly code = BillingErrorCode.PLAN_INACTIVE;
  readonly statusCode = 400;

  constructor(planKey: string) {
    super({
      message: `Plan '${planKey}' is inactive.`,
      metadata: {
        planKey,
      },
    });
  }
}