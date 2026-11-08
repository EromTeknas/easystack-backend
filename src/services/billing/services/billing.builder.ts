import { prisma } from "../../../db";
import { BillingCache } from "../types/billing-cache.type";
import { BILLING_CACHE_VERSION } from "../cache/cache.constants";
import { PlanRegistry } from "../config/plans";

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
    const scopedUsage: Record<string, Record<string, Record<string, number>>> = {};

    // Source of Truth: Seed baseline features and quotas from code plan definition
    const planKey = subscription?.planVersion?.plan?.key ?? 'free';
    const codePlan = PlanRegistry.find((p) => p.key === planKey) ?? PlanRegistry.find((p) => p.key === 'free');

    if (codePlan) {
      for (const [key, enabled] of Object.entries(codePlan.features)) {
        features[key] = enabled;
      }
      for (const [key, value] of Object.entries(codePlan.quotas)) {
        quotas[key] = value;
      }
    }

    // Database overrides / custom plan version adjustments
    if (subscription?.planVersion) {
      for (const planFeature of subscription.planVersion.features) {
        features[planFeature.feature.key] = planFeature.enabled;
      }

      for (const planQuota of subscription.planVersion.quotas) {
        quotas[planQuota.quota.key] = planQuota.value;
      }
    }

    for (const row of usageRows) {
      const scope = (row as any).scope || 'WORKSPACE';
      const scopeId = (row as any).scopeId || 'ALL';
      
      if (scope === 'WORKSPACE' && scopeId === 'ALL') {
        usage[row.quota.key] = row.value;
      } else {
        if (!scopedUsage[row.quota.key]) scopedUsage[row.quota.key] = {};
        if (!scopedUsage[row.quota.key]![scope]) scopedUsage[row.quota.key]![scope] = {};
        scopedUsage[row.quota.key]![scope]![scopeId] = row.value;
      }
    }

    // Compute live ground-truth values for entity-backed quotas
    usage['projects'] = await prisma.project.count({ where: { workspaceId } });
    usage['members'] = await prisma.workspaceMember.count({ where: { workspaceId, removedAt: null } });

    // Compute workspace-level storage in GB from all active project assets
    const assetAgg = await prisma.projectAsset.aggregate({
      where: { project: { workspaceId }, removedAt: null },
      _sum: { sizeBytes: true },
    });
    const totalAssetBytes = assetAgg._sum.sizeBytes ?? BigInt(0);
    usage['storage.gb'] = Math.round((Number(totalAssetBytes) / (1024 * 1024 * 1024)) * 100) / 100;

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
        : {
            id: 0,
            key: codePlan?.key ?? 'free',
            displayName: codePlan?.metadata?.displayName ?? 'Free',
            version: 1,
          },
      features,
      quotas,
      usage,
      scopedUsage,
    };
  }
}
