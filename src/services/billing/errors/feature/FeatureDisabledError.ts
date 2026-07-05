import { BillingError } from "../BillingError";
import { BillingErrorCode } from "../BillingErrorCode";

export class FeatureDisabledError extends BillingError {
  readonly code = BillingErrorCode.FEATURE_DISABLED;
  readonly statusCode = 403;

  constructor(featureKey: string) {
    super({
      message: `Feature '${featureKey}' is not available on the current plan.`,
      metadata: {
        featureKey,
      },
    });
  }
}