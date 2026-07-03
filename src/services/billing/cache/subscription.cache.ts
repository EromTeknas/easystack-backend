import { BillingCache, BillingSubscriptionCache } from "../types/billing-cache.type";

export class SubscriptionCache {
  static get(cache: BillingCache): BillingSubscriptionCache | null {
    return cache.subscription;
  }
}
