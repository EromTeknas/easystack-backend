import { SubscriptionStatus } from "@prisma/client";

export interface BillingSubscriptionCache {
  status: SubscriptionStatus;
  expiresAt: string | null;
  trialEndsAt: string | null;
  startsAt: string | null;
  cancelledAt: string | null;
  planKey: string;
  planDisplayName: string;
  planVersionId: number;
}

export interface BillingPlanCache {
  id: number;
  key: string;
  displayName: string;
  version: number;
}

export interface BillingCache {
  workspaceId: number;
  version: number;
  updatedAt: string;
  subscription: BillingSubscriptionCache | null;
  plan: BillingPlanCache | null;
  features: Record<string, boolean>;
  quotas: Record<string, number | null>;
  usage: Record<string, number>;
}
