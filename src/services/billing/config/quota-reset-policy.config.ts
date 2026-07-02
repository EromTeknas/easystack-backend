
export const QuotaResetPolicies = {
  NEVER: "never",
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  BILLING_CYCLE: "billing_cycle"
};

export type QuotaResetPolicy =
  (typeof QuotaResetPolicies)[keyof typeof QuotaResetPolicies];