import { prisma } from "../../../db";
import { BillingContextService } from "../cache/billing.context.service.ts";
import { FeatureCache } from "../cache/feature.cache.ts";

export class FeatureService {
  static async enabled(userId: number, featureKey: string): Promise<boolean> {
    const cache = await BillingContextService.get(userId);
    return FeatureCache.get(cache, featureKey);
  }

  static async has(userId: number, featureKey: string): Promise<boolean> {
    return await this.enabled(userId, featureKey);
  }

  static async all(userId: number) {
    const cache = await BillingContextService.get(userId);
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

}
