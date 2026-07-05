import { BillingCache } from "./billing-cache.type";

export interface BillingQuotaResult {
  key: string;
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface BillingAuthorizationResult {
  authorized: true;

  cache: BillingCache;

  quotas: BillingQuotaResult[];
}