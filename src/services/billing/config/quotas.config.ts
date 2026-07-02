import { QuotaResetPolicies } from "./quota-reset-policy.config";
export const Quotas = {
  PROJECTS: {
    key: "projects",
    displayName: "Projects",
    description: "Maximum projects",
    unit: "count",
    resetPolicy: QuotaResetPolicies.NEVER,
  },

  STORAGE: {
    key: "storage.gb",
    displayName: "Storage",
    description: "Maximum storage",
    unit: "GB",
    resetPolicy: QuotaResetPolicies.NEVER,
  },

  API_REQUESTS: {
    key: "api.requests.month",
    displayName: "API Requests",
    description: "Monthly API Requests",
    unit: "requests",
    resetPolicy: QuotaResetPolicies.BILLING_CYCLE,
  },
} as const;

export type QuotaKey = (typeof Quotas)[keyof typeof Quotas]['key'];