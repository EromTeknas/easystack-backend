import { QuotaResetPolicy } from "@prisma/client";

export interface QuotaConfigItem {
  key: string;
  displayName: string;
  description: string;
  unit: string;
  scope: 'WORKSPACE' | 'PROJECT';
  resetPolicy: QuotaResetPolicy;
}

export const Quotas = {
  PROJECTS: {
    key: "projects",
    displayName: "Projects",
    description: "Maximum projects",
    unit: "projects",
    scope: "WORKSPACE",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  STORAGE: {
    key: "storage.gb",
    displayName: "Storage",
    description: "Maximum storage",
    unit: "GB",
    scope: "WORKSPACE",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  ASSET_STORAGE_MB: {
    key: "asset_storage_mb",
    displayName: "Asset Storage",
    description: "Maximum media storage allowed across project assets",
    unit: "MB",
    scope: "PROJECT",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  API_REQUESTS: {
    key: "api.requests.daily",
    displayName: "API Requests (Daily)",
    description: "Daily API Requests",
    unit: "requests/day",
    scope: "WORKSPACE",
    resetPolicy: QuotaResetPolicy.DAILY,
  },


  ENVIRONMENTS_PER_PROJECT: {
    key: "environments_per_project",
    displayName: "Environments",
    description: "Maximum environments allowed per project",
    unit: "environments",
    scope: "PROJECT",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  BLUEPRINTS_PER_PROJECT: {
    key: "blueprints_per_project",
    displayName: "Content Blueprints",
    description: "Maximum content schema blueprints allowed per project",
    unit: "blueprints",
    scope: "PROJECT",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  DATA_ENTRIES_PER_PROJECT: {
    key: "data_entries_per_project",
    displayName: "Content Entries",
    description: "Maximum content entries allowed per project",
    unit: "entries",
    scope: "PROJECT",
    resetPolicy: QuotaResetPolicy.NEVER,
  },

  MEMBERS: {
    key: "members",
    displayName: "Team Members",
    description: "Maximum team members",
    unit: "members",
    scope: "WORKSPACE",
    resetPolicy: QuotaResetPolicy.NEVER,
  },
} as const;

export type QuotaKey = (typeof Quotas)[keyof typeof Quotas]['key'];

export function getQuotaDefinition(key: string): QuotaConfigItem | undefined {
  return Object.values(Quotas).find((q) => q.key === key) as QuotaConfigItem | undefined;
}

export function formatQuotaDisplayName(key: string): string {
  const def = getQuotaDefinition(key);
  if (def?.displayName) return def.displayName;

  // Fallback formatter for dynamic or custom keys
  return key
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => {
      const lower = word.toLowerCase();
      if (lower === 'mb' || lower === 'gb' || lower === 'api' || lower === 'url') return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}