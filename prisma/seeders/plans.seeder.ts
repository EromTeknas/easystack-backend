import { PrismaClient } from "@prisma/client";
import { Plans } from "./data/plans.data";

export async function seedPlans(prisma: PrismaClient) {
  console.log("🌱 Seeding Plans...");

  await prisma.$transaction(async (tx) => {
    for (const plan of Plans) {
      const dbPlan = await tx.plan.upsert({
        where: {
          key: plan.key,
        },

        update: {
          displayName: plan.displayName,
          description: plan.description,
          isActive: true,
        },

        create: {
          key: plan.key,
          displayName: plan.displayName,
          description: plan.description,
        },
      });

      await tx.planVersion.upsert({
        where: {
          planId_version: {
            planId: dbPlan.id,
            version: plan.version,
          },
        },

        update: {
          config: plan.config,
        },

        create: {
          planId: dbPlan.id,
          version: plan.version,
          config: plan.config,
        },
      });
    }
  });

  console.log("✅ Plans Seeded");
}