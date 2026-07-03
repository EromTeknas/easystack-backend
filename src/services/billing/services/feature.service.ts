import { prisma } from "../../../db";
import { BillingBuilder } from "./billing.builder.ts";
import { BillingCacheService } from "../cache/billing.cache.service.ts";
import { FeatureCache } from "../cache/feature.cache.ts";

export class FeatureService {
  private static readonly builder = new BillingBuilder();

  static async enabled(userId: number, featureKey: string): Promise<boolean> {
    const cache = await this.resolveCache(userId);
    return FeatureCache.get(cache, featureKey);
  }

  static async has(userId: number, featureKey: string): Promise<boolean> {
    return await this.enabled(userId, featureKey);
  }

  static async all(userId: number) {
    const cache = await this.resolveCache(userId);
    return FeatureCache.all(cache);
  }

  static async list() {
    return await prisma.feature.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
  }

  static async enable(planVersionId: number, featureKey: string) {
    const feature = await prisma.feature.findUnique({ where: { key: featureKey } });

    if (!feature) {
      throw new Error(`Feature '${featureKey}' not found.`);
    }

    await prisma.planFeature.upsert({
      where: {
        planVersionId_featureId: {
          planVersionId,
          featureId: feature.id,
        },
      },
      create: {
        planVersionId,
        featureId: feature.id,
        enabled: true,
      },
      update: {
        enabled: true,
      },
    });
  }

  static async disable(planVersionId: number, featureKey: string) {
    const feature = await prisma.feature.findUnique({ where: { key: featureKey } });

    if (!feature) {
      throw new Error(`Feature '${featureKey}' not found.`);
    }

    await prisma.planFeature.update({
      where: {
        planVersionId_featureId: {
          planVersionId,
          featureId: feature.id,
        },
      },
      data: {
        enabled: false,
      },
    });
  }

  private static async resolveCache(userId: number) {
    const cached = await BillingCacheService.get(userId);

    if (cached) {
      return cached;
    }

    const rebuilt = await this.builder.build(userId);
    await BillingCacheService.set(rebuilt);
    return rebuilt;
  }
}
