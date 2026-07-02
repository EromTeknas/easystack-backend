import { PrismaClient } from "@prisma/client";

import { PlanRegistry } from "../../src/services/billing/config/plans";

export async function seedBillingPlans(prisma: PrismaClient) {
  console.log("🌱 Seeding Billing Plans...");

  await prisma.$transaction(async (tx) => {
    for (const definition of PlanRegistry) {
      const plan = await tx.plan.upsert({
        where: {
          key: definition.key,
        },

        update: {
          displayName: definition.metadata.displayName,
          description: definition.metadata.description,
          isPublic: definition.metadata.isPublic,
          isEnterprise: definition.metadata.isEnterprise,
          isActive: definition.metadata.isActive,
          displayOrder: definition.metadata.displayOrder,
        },

        create: {
          key: definition.key,
          displayName: definition.metadata.displayName,
          description: definition.metadata.description,
          isPublic: definition.metadata.isPublic,
          isEnterprise: definition.metadata.isEnterprise,
          isActive: definition.metadata.isActive,
          displayOrder: definition.metadata.displayOrder,
        },
      });

      let version = await tx.planVersion.findUnique({
        where: {
          planId_version: {
            planId: plan.id,
            version: definition.version,
          },
        },
      });

      if (!version) {
        await tx.planVersion.updateMany({
          where: {
            planId: plan.id,
          },
          data: {
            isLatest: false,
          },
        });

        version = await tx.planVersion.create({
          data: {
            planId: plan.id,
            version: definition.version,
            isLatest: true,
          },
        });
      }

      await tx.trialConfiguration.upsert({
        where: {
          planVersionId: version.id,
        },

        update: {
          enabled: definition.trial.enabled,
          durationDays: definition.trial.durationDays,
        },

        create: {
          planVersionId: version.id,
          enabled: definition.trial.enabled,
          durationDays: definition.trial.durationDays,
        },
      });

      await tx.planPricing.deleteMany({
        where: {
          planVersionId: version.id,
        },
      });

      if (definition.pricing.length) {
        await tx.planPricing.createMany({
          data: definition.pricing.map((pricing) => ({
            planVersionId: version!.id,
            currency: pricing.currency,
            billingCycle: pricing.billingCycle,
            amount: pricing.amount,
            compareAtAmount: pricing.compareAtAmount,
            isDefault: pricing.isDefault ?? false,
          })),
        });
      }

      await tx.planFeature.deleteMany({
        where: {
          planVersionId: version.id,
        },
      });

      for (const [key, enabled] of Object.entries(definition.features)) {
        const feature = await tx.feature.findUnique({
          where: {
            key,
          },
        });

        if (!feature) {
          throw new Error(`Feature '${key}' not found.`);
        }

        await tx.planFeature.create({
          data: {
            planVersionId: version.id,
            featureId: feature.id,
            enabled,
          },
        });
      }

      await tx.planQuota.deleteMany({
        where: {
          planVersionId: version.id,
        },
      });

      for (const [key, value] of Object.entries(definition.quotas)) {
        const quota = await tx.quota.findUnique({
          where: {
            key,
          },
        });

        if (!quota) {
          throw new Error(`Quota '${key}' not found.`);
        }

        await tx.planQuota.create({
          data: {
            planVersionId: version.id,
            quotaId: quota.id,
            value,
          },
        });
      }
    }
  });

  console.log("✅ Billing Plans Seeded");
}