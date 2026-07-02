export const BillingCycles = {
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
} as const;

export type BillingCycle =
  (typeof BillingCycles)[keyof typeof BillingCycles];