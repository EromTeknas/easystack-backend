/**
 * Billing-related constants
 */

export const PLAN_NAMES = {
  FREE: 'free',
  PRO: 'pro',
  TEAM: 'team',
  ENTERPRISE: 'enterprise',
  CUSTOM: 'custom',
} as const;

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'ACTIVE',
  TRIAL: 'TRIAL',
  EXPIRED: 'EXPIRED',
  CANCELED: 'CANCELED',
} as const;

/**
 * Feature keys for billing guards
 */
export const FEATURE_KEYS = {
  PROJECTS: 'projects',
  ENVIRONMENTS: 'environments',
  USERS: 'users',
  API_REQUESTS_PER_MINUTE: 'api_requests_per_minute',
  STORAGE_MB: 'storage_mb',
  AI_TOKENS_MONTHLY: 'ai_tokens_monthly',
  CUSTOM_DOMAIN: 'custom_domain',
  TEAM_COLLABORATION: 'team_collaboration',
  AUDIT_LOGS: 'audit_logs',
} as const;

/**
 * Redis cache keys for billing
 */
export const BILLING_CACHE_KEYS = {
  USER_PLAN: (userId: number) => `billing:plan:${userId}`,
  USER_USAGE: (userId: number, month: string) => `billing:usage:${userId}:${month}`,
} as const;

/**
 * Cache TTL in seconds
 */
export const BILLING_CACHE_TTL = {
  PLAN: 300, // 5 minutes
  USAGE: 60, // 1 minute
} as const;
