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

  FEEDS_PER_PROJECT: {
    key: "feeds_per_project",
    displayName: "Feeds per Project",
    description: "Maximum feedback feeds allowed in a single project (legacy)",
    unit: "per project",
    scope: "PROJECT",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  ENVIRONMENTS_PER_PROJECT: {
    key: "environments_per_project",
    displayName: "Environments per Project",
    description: "Maximum environments allowed per project",
    unit: "environments",
    scope: "PROJECT",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  BLUEPRINTS_PER_PROJECT: {
    key: "blueprints_per_project",
    displayName: "Blueprints per Project",
    description: "Maximum content schema blueprints allowed per project",
    unit: "blueprints",
    scope: "PROJECT",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  DATA_ENTRIES_PER_PROJECT: {
    key: "data_entries_per_project",
    displayName: "Data Entries per Project",
    description: "Maximum content entries allowed per project",
    unit: "entries",
    scope: "PROJECT",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  MEMBERS: {
    key: "members",
    displayName: "Members",
    description: "Maximum team members",
    unit: "count",
    resetPolicy: QuotaResetPolicy.NEVER,
  },
} as const;

export type QuotaKey = (typeof Quotas)[keyof typeof Quotas]['key'];