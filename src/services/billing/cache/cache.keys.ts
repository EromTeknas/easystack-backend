export const BILLING_CACHE_KEYS = {
  USER: (userId: number) => `billing:v1:user:${userId}`,
  USER_USAGE: (userId: number) => `billing:v1:user:${userId}:usage`,
  USER_FEATURES: (userId: number) => `billing:v1:user:${userId}:features`,
  USER_QUOTAS: (userId: number) => `billing:v1:user:${userId}:quotas`,
  USER_SUBSCRIPTION: (userId: number) => `billing:v1:user:${userId}:subscription`,
  USER_PLAN: (userId: number) => `billing:v1:user:${userId}:plan`,
};
