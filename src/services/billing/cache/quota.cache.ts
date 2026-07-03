import { BillingCache } from "../types/billing-cache.type";

export class QuotaCache {
  static getLimit(cache: BillingCache, quotaKey: string): number | null {
    return cache.quotas[quotaKey] ?? null;
  }

  static all(cache: BillingCache): Record<string, number | null> {
    return cache.quotas;
  }

  static isUnlimited(cache: BillingCache, quotaKey: string): boolean {
    return this.getLimit(cache, quotaKey) === null;
  }
}
