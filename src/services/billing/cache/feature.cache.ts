import { BillingCache } from "../types/billing-cache.type";

export class FeatureCache {
  static get(cache: BillingCache, featureKey: string): boolean {
    return cache.features[featureKey] ?? false;
  }

  static all(cache: BillingCache): Record<string, boolean> {
    return cache.features;
  }
}
