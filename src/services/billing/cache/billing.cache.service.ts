import redis from "../../../config/redis";
import { BillingCache } from "../types/billing-cache.type";
import { BILLING_CACHE_KEYS } from "./cache.keys";

export class BillingCacheService {
  static async get(userId: number): Promise<BillingCache | null> {
    const cached = await redis.get(BILLING_CACHE_KEYS.USER(userId));

    return cached ? (JSON.parse(cached) as BillingCache) : null;
  }

  static async set(cache: BillingCache, ttlSeconds?: number): Promise<void> {
    const key = BILLING_CACHE_KEYS.USER(cache.userId);

    if (ttlSeconds) {
      await redis.set(key, JSON.stringify(cache), "EX", ttlSeconds);
      return;
    }

    await redis.set(key, JSON.stringify(cache));
  }

  static async exists(userId: number): Promise<boolean> {
    return (await redis.exists(BILLING_CACHE_KEYS.USER(userId))) === 1;
  }

  static async evict(userId: number): Promise<void> {
    await redis.del(BILLING_CACHE_KEYS.USER(userId));
  }
}
