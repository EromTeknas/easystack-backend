import { PrismaClient } from "@prisma/client";

import { Features } from "../../src/services/billing/config/features.config";

export async function seedBillingFeatures(prisma: PrismaClient) {
  console.log("🌱 Seeding Billing Features...");

  await prisma.$transaction(async (tx) => {
    for (const feature of Object.values(Features)) {
      await tx.feature.upsert({
        where: {
          key: feature.key,
        },

        update: {
          displayName: feature.displayName,
          description: feature.description,
          category: feature.category,
          isActive: true,
        },

        create: {
          key: feature.key,
          displayName: feature.displayName,
          description: feature.description,
          category: feature.category,
          isActive: true,
        },
      });
    }
  });

  console.log("✅ Billing Features Seeded");
}