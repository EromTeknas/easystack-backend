import { BillingCache } from "../types/billing-cache.type.ts";
import { BillingQuotaRequest } from "../types/billing-authorization.type.ts";
import { InvalidQuotaError, QuotaExceededError, QuotaNotFoundError } from "../errors/index.ts";

export class QuotaValidator {
  static validateRequest(cache: BillingCache, quotas: BillingQuotaRequest[]): void {
    const seen = new Set<string>();

    for (const quota of quotas) {
      if (!quota.key || seen.has(quota.key)) {
        throw new InvalidQuotaError(quota.key || "unknown");
      }

      seen.add(quota.key);

      if (!Object.prototype.hasOwnProperty.call(cache.quotas, quota.key)) {
        throw new QuotaNotFoundError(quota.key);
      }

      const amount = quota.amount ?? 1;

      if (!Number.isInteger(amount) || amount < 1) {
        throw new InvalidQuotaError(quota.key);
      }

      const limit = cache.quotas[quota.key] ?? null;
      const used = cache.usage[quota.key] ?? 0;

      if (limit !== null && used + amount > limit) {
        throw new QuotaExceededError(quota.key, limit, used, amount);
      }
    }
  }
}