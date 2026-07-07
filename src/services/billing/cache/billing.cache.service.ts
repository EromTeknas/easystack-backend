import redis from "../../../config/redis";
import { BillingCache } from "../types/billing-cache.type";
import { BILLING_CACHE_KEYS } from "./cache.keys";

export class BillingCacheService {
  static async get(workspaceId: number): Promise<BillingCache | null> {
    const cached = await redis.get(BILLING_CACHE_KEYS.WORKSPACE(workspaceId));

    return cached ? (JSON.parse(cached) as BillingCache) : null;
  }

  static async set(cache: BillingCache, ttlSeconds?: number): Promise<void> {
    const key = BILLING_CACHE_KEYS.WORKSPACE(cache.workspaceId);

    if (ttlSeconds) {
      await redis.set(key, JSON.stringify(cache), "EX", ttlSeconds);
      return;
    }

    await redis.set(key, JSON.stringify(cache));
  }

  static async exists(workspaceId: number): Promise<boolean> {
    return (await redis.exists(BILLING_CACHE_KEYS.WORKSPACE(workspaceId))) === 1;
  }

  static async evict(workspaceId: number): Promise<void> {
    await redis.del(BILLING_CACHE_KEYS.WORKSPACE(workspaceId));
  }
}
