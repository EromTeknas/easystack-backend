export interface BillingQuotaRequest {
  key: string;

  /**
   * Amount to validate against the quota.
   */
  amount?: number;

  /**
   * Consume quota if validation succeeds.
   */
  consume?: boolean;

  /**
   * The scope of the usage bucket.
   */
  scope?: string;

  /**
   * The identifier for the scope.
   */
  scopeId?: string;
}

export interface BillingAuthorizationRequest {
  /**
   * Require an active subscription.
   */
  subscription?: boolean;

  /**
   * Require active paid subscription.
   * Trial subscriptions will fail.
   */
  paidSubscription?: boolean;

  /**
   * Required features.
   */
  features?: string[];

  /**
   * Required quotas.
   */
  quotas?: BillingQuotaRequest[];
}