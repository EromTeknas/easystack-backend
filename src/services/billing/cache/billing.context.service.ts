import { BILLING_CACHE_TTL_SECONDS } from "./cache.constants.ts";
import { BillingCacheService } from "./billing.cache.service.ts";
import { BillingBuilder } from "../services/billing.builder.ts";
import { BillingCache } from "../types/billing-cache.type.ts";

export class BillingContextService {
  private static readonly builder = new BillingBuilder();

  static async get(userId: number): Promise<BillingCache> {
    const cached = await BillingCacheService.get(userId);

    if (cached) {
      return cached;
    }

    return await this.refresh(userId);
  }

  static async refresh(userId: number): Promise<BillingCache> {
    const cache = await this.builder.build(userId);
    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    return cache;
  }

  static async refreshMany(userIds: number[]): Promise<BillingCache[]> {
    return await Promise.all(userIds.map((userId) => this.refresh(userId)));
  }

  static async invalidate(userId: number): Promise<void> {
    await BillingCacheService.evict(userId);
  }
}