import { BillingError } from "../BillingError";
import { BillingErrorCode } from "../BillingErrorCode";

export class PlanNotFoundError extends BillingError {
  readonly code = BillingErrorCode.PLAN_NOT_FOUND;
  readonly statusCode = 404;

  constructor(planKey: string) {
    super({
      message: `Plan '${planKey}' does not exist.`,
      metadata: {
        planKey,
      },
    });
  }
}