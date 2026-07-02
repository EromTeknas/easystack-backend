import { PrismaClient } from "@prisma/client";

import { Quotas } from "../../src/services/billing/config/quotas.config";

export async function seedBillingQuotas(prisma: PrismaClient) {
  console.log("🌱 Seeding Billing Quotas...");

  await prisma.$transaction(async (tx) => {
    for (const quota of Object.values(Quotas)) {
      await tx.quota.upsert({
        where: {
          key: quota.key,
        },

        update: {
          displayName: quota.displayName,
          description: quota.description,
          unit: quota.unit,
          resetPolicy: quota.resetPolicy,
        },

        create: {
          key: quota.key,
          displayName: quota.displayName,
          description: quota.description,
          unit: quota.unit,
          resetPolicy: quota.resetPolicy,
        },
      });
    }
  });

  console.log("✅ Billing Quotas Seeded");
}