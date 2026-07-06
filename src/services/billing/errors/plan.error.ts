import { BillingError } from "./BillingError";
import { BillingErrorCode } from "./BillingErrorCode";

export class FeatureDisabledError extends BillingError {
  constructor(featureKey: string) {
    super(`Feature '${featureKey}' is not available on the current plan.`, 403, BillingErrorCode.FEATURE_DISABLED, { featureKey });
  }
}

export class PlanNotFoundError extends BillingError {
  constructor(planKey: string) {
    super(`Plan '${planKey}' does not exist.`, 404, BillingErrorCode.PLAN_NOT_FOUND, { planKey });
  }
}

export class InvalidPlanError extends BillingError {
  constructor(planKey: string) {
    super(`Plan '${planKey}' is invalid.`, 400, BillingErrorCode.INVALID_PLAN, { planKey });
  }
}

export class PlanInactiveError extends BillingError {
  constructor(planKey: string) {
    super(`Plan '${planKey}' is inactive.`, 400, BillingErrorCode.PLAN_INACTIVE, { planKey });
  }
}