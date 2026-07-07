import { BILLING_CACHE_TTL_SECONDS } from "./cache.constants.ts";
import { BillingCacheService } from "./billing.cache.service.ts";
import { BillingBuilder } from "../services/billing.builder.ts";
import { BillingCache } from "../types/billing-cache.type.ts";

export class BillingContextService {
  private static readonly builder = new BillingBuilder();

  static async get(workspaceId: number): Promise<BillingCache> {
    const cached = await BillingCacheService.get(workspaceId);

    if (cached) {
      return cached;
    }

    return await this.refresh(workspaceId);
  }

  static async refresh(workspaceId: number): Promise<BillingCache> {
    const cache = await this.builder.build(workspaceId);
    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    return cache;
  }

  static async refreshMany(workspaceIds: number[]): Promise<BillingCache[]> {
    return await Promise.all(workspaceIds.map((workspaceId) => this.refresh(workspaceId)));
  }

  static async invalidate(workspaceId: number): Promise<void> {
    await BillingCacheService.evict(workspaceId);
  }
}
