import { BillingCache } from "../types/billing-cache.type.ts";
import { BillingCacheService } from "../cache/billing.cache.service.ts";
import { BILLING_CACHE_TTL_SECONDS } from "../cache/cache.constants.ts";
import { FeatureCache } from "../cache/feature.cache.ts";
import { QuotaCache } from "../cache/quota.cache.ts";
import { SubscriptionCache } from "../cache/subscription.cache.ts";
import { UsageCache } from "../cache/usage.cache.ts";
import { BillingContextService } from "../cache/billing.context.service.ts";
import { BillingLockService } from "../cache/billing.lock.service.ts";
import { SubscriptionService } from "./subscription.service.ts";
import { UsageService } from "./usage.service.ts";
import { PlanRepository } from "../repositories/plan.repository.ts";
import { prisma } from "../../../db";
import { FeatureDisabledError, QuotaExceededError, SubscriptionRequiredError } from "../errors/index.ts";
import { BillingAuthorizationRequest } from "../types/billing-authorization.type.ts";
import { BillingAuthorizationResult, BillingQuotaResult } from "../types/billing-authorization-result.type.ts";
import { QuotaValidator } from "../validators/quota.validator.ts";
import { SubscriptionValidator } from "../validators/subscription.validator.ts";
import { SubscriptionStatus } from "@prisma/client";

export class BillingService {
  private static readonly usageCache = new UsageCache();

  static async get(workspaceId: number): Promise<BillingCache> {
    return await BillingContextService.get(workspaceId);
  }

  static async rebuild(workspaceId: number): Promise<BillingCache> {
    return await BillingContextService.refresh(workspaceId);
  }

  static async refresh(workspaceId: number): Promise<BillingCache> {
    return await BillingContextService.refresh(workspaceId);
  }

  static async refreshMany(workspaceIds: number[]): Promise<BillingCache[]> {
    return await BillingContextService.refreshMany(workspaceIds);
  }

  static async invalidate(workspaceId: number): Promise<void> {
    await BillingContextService.invalidate(workspaceId);
  }

  static async subscription(workspaceId: number) {
    return SubscriptionCache.get(await this.get(workspaceId));
  }

  static async plan(workspaceId: number) {
    return (await this.get(workspaceId)).plan;
  }

  static async features(workspaceId: number) {
    return FeatureCache.all(await this.get(workspaceId));
  }

  static async quotas(workspaceId: number) {
    return QuotaCache.all(await this.get(workspaceId));
  }

  static async usage(workspaceId: number) {
    return (await this.get(workspaceId)).usage;
  }

  static async getEffectivePlan(workspaceId: number) {
    const cache = await this.get(workspaceId);

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

  static async getWorkspaceUsage(workspaceId: number) {
    return await this.usage(workspaceId);
  }

  static async hasFeature(
    workspaceId: number,
    featureKey: string,
  ): Promise<boolean> {
    const cache = await this.get(workspaceId);
    return FeatureCache.get(cache, featureKey);
  }

  static async canUseFeature(
    workspaceId: number,
    featureKey: string,
  ): Promise<boolean> {
    return this.hasFeature(workspaceId, featureKey);
  }

  static async getLimit(
    workspaceId: number,
    quotaKey: string,
  ): Promise<number | null> {
    const cache = await this.get(workspaceId);
    return QuotaCache.getLimit(cache, quotaKey);
  }

  static async isUnlimited(workspaceId: number, quotaKey: string): Promise<boolean> {
    const cache = await this.get(workspaceId);
    return QuotaCache.isUnlimited(cache, quotaKey);
  }

  static async canPerformAction(
    workspaceId: number,
    quotaKey: string,
  ): Promise<{
    allowed: boolean;
    limit: number | null;
    used: number;
    remaining: number | null;
  }> {
    const cache = await this.get(workspaceId);
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

  static async consumeQuota(
    workspaceId: number,
    quotaKey: string,
    amount: number = 1,
  ) {
    return await UsageService.consume(workspaceId, quotaKey, amount);
  }

  static async releaseQuota(
    workspaceId: number,
    quotaKey: string,
    amount: number = 1,
  ) {
    return await UsageService.release(workspaceId, quotaKey, amount);
  }

  static async remaining(
    workspaceId: number,
    quotaKey: string,
  ): Promise<number | null> {
    return await UsageService.remaining(workspaceId, quotaKey);
  }

  static async reset(workspaceId: number, quotaKey?: string) {
    return await UsageService.reset(workspaceId, quotaKey);
  }

  static async invalidateCache(workspaceId: number): Promise<void> {
    await this.invalidate(workspaceId);
  }

  static async rebuildCache(workspaceId: number): Promise<BillingCache> {
    return await this.rebuild(workspaceId);
  }

  static async isTrial(workspaceId: number): Promise<boolean> {
    const subscription = await this.subscription(workspaceId);
    return subscription?.status === SubscriptionStatus.TRIAL;
  }

  static async isActive(workspaceId: number): Promise<boolean> {
    const subscription = await this.subscription(workspaceId);
    return (
      subscription?.status === SubscriptionStatus.ACTIVE || subscription?.status === SubscriptionStatus.TRIAL
    );
  }

  static async createFreeSubscription(workspaceId: number, billingOwnerId?: number) {
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
        where: { workspaceId },
        create: {
          workspaceId,
          billingOwnerId: billingOwnerId ?? null,
          planVersionId: latest.id,
          status: SubscriptionStatus.ACTIVE,
          startsAt: new Date(),
        },
        update: {
          planVersionId: latest.id,
          status: SubscriptionStatus.ACTIVE,
          startsAt: new Date(),
          expiresAt: null,
          cancelledAt: null,
          billingOwnerId: billingOwnerId ?? null,
        },
      });
    });

    await UsageService.initialize(workspaceId, freePlan.id);

    return await this.refresh(workspaceId);
  }

  static async authorizeAndConsume(
    workspaceId: number,
    request: BillingAuthorizationRequest,
  ): Promise<BillingAuthorizationResult> {
    return await BillingLockService.withWorkspaceLock(workspaceId, async () => {
      return await this.authorizeInternal(workspaceId, request, true);
    });
  }

  public static async authorize(
    workspaceId: number,
    request: BillingAuthorizationRequest,
  ): Promise<BillingAuthorizationResult> {
    const shouldConsume = request.quotas?.some((quota) => quota.consume) ?? false;

    if (shouldConsume) {
      return await BillingLockService.withWorkspaceLock(workspaceId, async () => {
        return await this.authorizeInternal(workspaceId, request, true);
      });
    }

    return await this.authorizeInternal(workspaceId, request, false);
  }

  private static async authorizeInternal(
    workspaceId: number,
    request: BillingAuthorizationRequest,
    consumeQuotas: boolean,
  ): Promise<BillingAuthorizationResult> {
    const cache = await this.get(workspaceId);

    if (!cache.subscription) {
      throw new SubscriptionRequiredError();
    }

    SubscriptionValidator.validate(cache, request);

    const quotaResults: BillingQuotaResult[] = [];
    const consumedUsage = new Map<string, number>();

    if (request.features?.length) {
      for (const featureKey of request.features) {
        const enabled = cache.features[featureKey];

        if (!enabled) {
          throw new FeatureDisabledError(featureKey);
        }
      }
    }

    if (request.quotas?.length) {
      QuotaValidator.validateRequest(cache, request.quotas);

      for (const quota of request.quotas) {
        const amount = quota.amount ?? 1;
        const limit = QuotaCache.getLimit(cache, quota.key);
        const used = cache.usage[quota.key] ?? 0;

        quotaResults.push({
          key: quota.key,
          limit,
          used,
          remaining: limit === null ? null : Math.max(0, limit - (used + amount)),
        });

        if (!consumeQuotas || !quota.consume) {
          continue;
        }

        consumedUsage.set(quota.key, used + amount);
      }

      if (consumeQuotas && consumedUsage.size > 0) {
        for (const [quotaKey, nextValue] of consumedUsage.entries()) {
          // Delegate to UsageService: Updates Redis, BillingCache, AND triggers scheduleSync()
          await UsageService.setWithinLock(workspaceId, quotaKey, nextValue);
          
          // Keep our local result object in sync to return to the middleware
          cache.usage[quotaKey] = nextValue;
        }
      }
    }

    return {
      authorized: true,
      cache,
      quotas: quotaResults,
    };
  }
}
