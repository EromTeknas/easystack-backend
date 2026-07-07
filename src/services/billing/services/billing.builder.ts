import { prisma } from "../../../db";
import { BillingCache } from "../types/billing-cache.type";
import { BILLING_CACHE_VERSION } from "../cache/cache.constants";

export class BillingBuilder {
  async build(workspaceId: number): Promise<BillingCache> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        subscription: {
          include: {
            planVersion: {
              include: {
                plan: true,
                features: { include: { feature: true } },
                quotas: { include: { quota: true } },
              },
            },
          },
        },
      },
    });
    const subscription = workspace?.subscription ?? null;

    const usageRows = await prisma.usage.findMany({
      where: { workspaceId },
      include: { quota: true },
    });

    const features: Record<string, boolean> = {};
    const quotas: Record<string, number | null> = {};
    const usage: Record<string, number> = {};

    if (subscription?.planVersion) {
      for (const planFeature of subscription.planVersion.features) {
        features[planFeature.feature.key] = planFeature.enabled;
      }

      for (const planQuota of subscription.planVersion.quotas) {
        quotas[planQuota.quota.key] = planQuota.value;
      }
    }

    for (const row of usageRows) {
      usage[row.quota.key] = row.value;
    }

    return {
      workspaceId,
      version: BILLING_CACHE_VERSION,
      updatedAt: new Date().toISOString(),
      subscription: subscription
        ? {
            status: subscription.status,
            expiresAt: subscription.expiresAt ? subscription.expiresAt.toISOString() : null,
            trialEndsAt: subscription.trialEndsAt ? subscription.trialEndsAt.toISOString() : null,
            startsAt: subscription.startsAt ? subscription.startsAt.toISOString() : null,
            cancelledAt: subscription.cancelledAt ? subscription.cancelledAt.toISOString() : null,
            planKey: subscription.planVersion.plan.key,
            planDisplayName: subscription.planVersion.plan.displayName,
            planVersionId: subscription.planVersion.id,
          }
        : null,
      plan: subscription?.planVersion
        ? {
            id: subscription.planVersion.plan.id,
            key: subscription.planVersion.plan.key,
            displayName: subscription.planVersion.plan.displayName,
            version: subscription.planVersion.version,
          }
        : null,
      features,
      quotas,
      usage,
    };
  }
}
