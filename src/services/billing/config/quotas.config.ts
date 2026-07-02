import { QuotaResetPolicy } from "@prisma/client";
export const Quotas = {
  PROJECTS: {
    key: "projects",
    displayName: "Projects",
    description: "Maximum projects",
    unit: "count",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  STORAGE: {
    key: "storage.gb",
    displayName: "Storage",
    description: "Maximum storage",
    unit: "GB",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  API_REQUESTS: {
    key: "api.requests.month",
    displayName: "API Requests",
    description: "Monthly API Requests",
    unit: "requests",
    resetPolicy: QuotaResetPolicy.BILLING_CYCLE,
  },
} as const;

export type QuotaKey = (typeof Quotas)[keyof typeof Quotas]['key'];