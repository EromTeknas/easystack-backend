import { QuotaResetPolicy, Prisma } from "@prisma/client";
import { prisma } from "../../../db";
import { BillingService } from "./billing.service.ts";
import { UsageService } from "./usage.service.ts";
import { BillingContextService } from "../cache/billing.context.service.ts";

export class ResetService {
  static async resetByPolicy(policy: QuotaResetPolicy) {
    const quotas = await prisma.quota.findMany({
      where: { resetPolicy: policy },
      include: {
        usage: true,
      },
    });

    const affectedUserIds = new Set<number>();

    for (const quota of quotas) {
      for (const usage of quota.usage) {
        await prisma.usage.update({
          where: { userId_quotaId: { userId: usage.userId, quotaId: quota.id } },
          data: { value: 0, resetAt: new Date() },
        });
        affectedUserIds.add(usage.userId);
      }
    }

    await BillingContextService.refreshMany([...affectedUserIds]);

    return {
      policy,
      resetCount: quotas.length,
      affectedUserCount: affectedUserIds.size,
    };
  }

  static async resetDueUsage() {
    const policies = [
      QuotaResetPolicy.DAILY,
      QuotaResetPolicy.WEEKLY,
      QuotaResetPolicy.MONTHLY,
      QuotaResetPolicy.BILLING_CYCLE,
    ];

    const results = [];

    for (const policy of policies) {
      results.push(await this.resetByPolicy(policy));
    }

    return results;
  }

  static async resetUserQuota(userId: number, quotaKey?: string) {
    await UsageService.reset(userId, quotaKey);
    await BillingContextService.refresh(userId);
  }
}
