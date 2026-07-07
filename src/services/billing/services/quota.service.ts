import { Prisma, PrismaClient } from "@prisma/client";

import { QuotaRepository } from "../repositories/quota.repository";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { BillingService } from "./billing.service.ts";

export class QuotaService {
  private readonly quotas: QuotaRepository;
  private readonly subscriptions: SubscriptionRepository;

  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {
    this.quotas = new QuotaRepository(prisma);
    this.subscriptions = new SubscriptionRepository(prisma);
  }

  /**
   * Returns a quota definition by its key.
   *
   * Lifecycle
   * ---------
   * Used whenever the application needs metadata about a quota,
   * such as:
   *
   * - display name
   * - reset policy
   * - unit
   * - description
   *
   * Does NOT return the user's quota limit.
   */
  async getQuota(quotaKey: string) {
    const quota = await this.quotas.findByKey(quotaKey);

    if (!quota) {
      throw new Error(`Quota '${quotaKey}' not found.`);
    }

    return quota;
  }

  /**
   * Returns every quota configured in the system.
   *
   * Lifecycle
   * ---------
   * Mostly used by:
   *
   * - Admin dashboard
   * - Seeder verification
   * - Documentation
   */
  async listQuotas() {
    return this.quotas.findMany();
  }

  /**
   * Returns the quota limit for the workspace's current subscription.
   *
   * Example
   * -------
   *
   * Free
   * ----
   * projects -> 1
   *
   * Pro
   * ---
   * projects -> 50
   *
   * Enterprise
   * ----------
   * projects -> null (Unlimited)
   *
   * Lifecycle
   * ---------
   * This is called before UsageService performs any usage checks.
   */
  async getLimit(
    workspaceId: number,
    quotaKey: string,
  ): Promise<number | null> {
    const cache = await BillingService.get(workspaceId);
    const limit = cache.quotas[quotaKey];

    if (typeof limit === "undefined") {
      throw new Error(`Quota '${quotaKey}' is not assigned to this plan.`);
    }

    return limit;
  }

  /**
   * Returns all quota limits available for the workspace's plan.
   *
   * Lifecycle
   * ---------
   * Useful for:
   *
   * - Billing page
   * - Dashboard
   * - "Your Plan" page
   * - Mobile applications
   */
  async listPlanQuotas(workspaceId: number) {
    const cache = await BillingService.get(workspaceId);
    const quotaKeys = Object.keys(cache.quotas);

    const definitions = await this.prisma.quota.findMany({
      where: { key: { in: quotaKeys } },
    });

    return definitions.map((quota) => ({
      key: quota.key,
      displayName: quota.displayName,
      description: quota.description,
      unit: quota.unit,
      resetPolicy: quota.resetPolicy,
      limit: cache.quotas[quota.key] ?? null,
    }));
  }

  /**
   * Determines whether the quota is unlimited.
   *
   * Enterprise plans typically return true because
   * the stored limit is NULL.
   *
   * Lifecycle
   * ---------
   * Called by AuthorizationService before denying access.
   */
  async isUnlimited(
    workspaceId: number,
    quotaKey: string,
  ): Promise<boolean> {
    const cache = await BillingService.get(workspaceId);
    return cache.quotas[quotaKey] === null;
  }
}
