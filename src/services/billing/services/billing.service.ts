import { BillingCache } from "../types/billing-cache.type.ts";
import { BillingBuilder } from "./billing.builder.ts";
import { BillingCacheService } from "../cache/billing.cache.service.ts";
import { BILLING_CACHE_TTL_SECONDS } from "../cache/cache.constants.ts";
import { FeatureCache } from "../cache/feature.cache.ts";
import { QuotaCache } from "../cache/quota.cache.ts";
import { SubscriptionCache } from "../cache/subscription.cache.ts";
import { UsageCache } from "../cache/usage.cache.ts";
import { SubscriptionService } from "./subscription.service.ts";
import { UsageService } from "./usage.service.ts";
import { PlanRepository } from "../repositories/plan.repository.ts";
import { prisma } from "../../../db";

export class BillingService {
  private static readonly builder = new BillingBuilder();
  private static readonly usageCache = new UsageCache();

  static async get(userId: number): Promise<BillingCache> {
    const cached = await BillingCacheService.get(userId);

    if (cached) {
      return cached;
    }

    return await this.rebuild(userId);
  }

  static async rebuild(userId: number): Promise<BillingCache> {
    const cache = await this.builder.build(userId);
    await BillingCacheService.set(cache, BILLING_CACHE_TTL_SECONDS);
    return cache;
  }

  static async invalidate(userId: number): Promise<void> {
    await BillingCacheService.evict(userId);
  }

  static async subscription(userId: number) {
    return SubscriptionCache.get(await this.get(userId));
  }

  static async plan(userId: number) {
    return (await this.get(userId)).plan;
  }

  static async features(userId: number) {
    return FeatureCache.all(await this.get(userId));
  }

  static async quotas(userId: number) {
    return QuotaCache.all(await this.get(userId));
  }

  static async usage(userId: number) {
    return (await this.get(userId)).usage;
  }

  static async getEffectivePlan(userId: number) {
    const cache = await this.get(userId);

    if (!cache.plan || !cache.subscription) {
      return null;
    }

    return {
      id: cache.plan.id,
      name: cache.plan.key,
      displayName: cache.plan.displayName,
      config: {
        features: cache.features,
        limits: cache.quotas,
      },
    };
  }

  static async getUserUsage(userId: number) {
    return await this.usage(userId);
  }

  static async hasFeature(userId: number, featureKey: string): Promise<boolean> {
    const cache = await this.get(userId);
    return FeatureCache.get(cache, featureKey);
  }

  static async canUseFeature(userId: number, featureKey: string): Promise<boolean> {
    return this.hasFeature(userId, featureKey);
  }

  static async getLimit(userId: number, quotaKey: string): Promise<number | null> {
    const cache = await this.get(userId);
    return QuotaCache.getLimit(cache, quotaKey);
  }

  static async isUnlimited(userId: number, quotaKey: string): Promise<boolean> {
    const cache = await this.get(userId);
    return QuotaCache.isUnlimited(cache, quotaKey);
  }

  static async canPerformAction(
    userId: number,
    quotaKey: string,
  ): Promise<{ allowed: boolean; limit: number | null; used: number; remaining: number | null }> {
    const cache = await this.get(userId);
    const limit = QuotaCache.getLimit(cache, quotaKey);
    const used = cache.usage[quotaKey] ?? 0;

    if (limit === null) {
      return { allowed: true, limit: null, used, remaining: null };
    }

    const remaining = Math.max(0, limit - used);

    return {
      allowed: used < limit,
      limit,
      used,
      remaining,
    };
  }

  static async consumeQuota(userId: number, quotaKey: string, amount: number = 1) {
    return await UsageService.consume(userId, quotaKey, amount);
  }

  static async releaseQuota(userId: number, quotaKey: string, amount: number = 1) {
    return await UsageService.release(userId, quotaKey, amount);
  }

  static async remaining(userId: number, quotaKey: string): Promise<number | null> {
    return await UsageService.remaining(userId, quotaKey);
  }

  static async reset(userId: number, quotaKey?: string) {
    return await UsageService.reset(userId, quotaKey);
  }

  static async invalidateCache(userId: number): Promise<void> {
    await this.invalidate(userId);
  }

  static async rebuildCache(userId: number): Promise<BillingCache> {
    return await this.rebuild(userId);
  }

  static async isTrial(userId: number): Promise<boolean> {
    const subscription = await this.subscription(userId);
    return subscription?.status === "TRIAL";
  }

  static async isActive(userId: number): Promise<boolean> {
    const subscription = await this.subscription(userId);
    return subscription?.status === "ACTIVE" || subscription?.status === "TRIAL";
  }

  static async createFreeSubscription(userId: number) {
    const planRepository = new PlanRepository(prisma);
    const freePlan = await planRepository.findLatestVersion("free");

    if (!freePlan) {
      throw new Error("Free plan not found.");
    }

    await prisma.$transaction(async (tx) => {
      const latest = await tx.planVersion.findFirst({
        where: {
          plan: { key: "free" },
          isLatest: true,
        },
      });

      if (!latest) {
        throw new Error("Free plan version not found.");
      }

      await tx.subscription.upsert({
        where: { userId },
        create: {
          userId,
          planVersionId: latest.id,
          status: "ACTIVE",
          startsAt: new Date(),
        },
        update: {
          planVersionId: latest.id,
          status: "ACTIVE",
          startsAt: new Date(),
          expiresAt: null,
          cancelledAt: null,
        },
      });
    });

    await UsageService.initialize(userId, freePlan.id);
    await this.invalidate(userId);

    return await this.rebuild(userId);
  }
}
