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
    key: "api.requests.daily",
    displayName: "API Requests",
    description: "Daily API Requests",
    unit: "requests",
    resetPolicy: QuotaResetPolicy.DAILY,
  },
} as const;

export type QuotaKey = (typeof Quotas)[keyof typeof Quotas]['key'];