export interface BillingQuotaRequest {
  key: string;

  /**
   * Amount to validate against the quota.
   *
   * Example:
   * 1 Project
   * 5 GB Storage
   * 100 API Calls
   */
  amount?: number;

  /**
   * Consume quota if validation succeeds.
   */
  consume?: boolean;
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