import { QuotaResetPolicy } from "@prisma/client";
import { prisma } from "../../../db";
import { UsageService } from "./usage.service.ts";
import { BillingContextService } from "../cache/billing.context.service.ts";
import { billingConfig } from "../../../config";

export class ResetService {
  static async resetDueUsage(currentDate: Date = new Date()) {
    const results = [];
    const resetTestMode = billingConfig.resetTestMode;
    const policiesToReset: QuotaResetPolicy[] = [QuotaResetPolicy.DAILY];

    if (resetTestMode || currentDate.getUTCDay() === 1) {
      policiesToReset.push(QuotaResetPolicy.WEEKLY);
    }

    if (resetTestMode || currentDate.getUTCDate() === 1) {
      policiesToReset.push(QuotaResetPolicy.MONTHLY);
    }

    for (const policy of policiesToReset) {
      results.push(await this.resetByPolicy(policy, currentDate, resetTestMode));
    }

    results.push(await this.resetBillingCycleUsages(currentDate));

    return results;
  }

  private static resetBoundary(policy: QuotaResetPolicy, currentDate: Date) {
    const boundary = new Date(currentDate);
    boundary.setUTCHours(0, 0, 0, 0);

    if (policy === QuotaResetPolicy.WEEKLY) {
      const day = boundary.getUTCDay();
      const daysSinceMonday = (day + 6) % 7;
      boundary.setUTCDate(boundary.getUTCDate() - daysSinceMonday);
    }

    if (policy === QuotaResetPolicy.MONTHLY) {
      boundary.setUTCDate(1);
    }

    return boundary;
  }

  static async resetByPolicy(
    policy: QuotaResetPolicy,
    currentDate: Date = new Date(),
    force = false,
  ) {
    const resetBefore = this.resetBoundary(policy, currentDate);

    const quotas = await prisma.quota.findMany({
      where: { resetPolicy: policy },
      include: {
        usage: {
          where: force
            ? {}
            : {
                OR: [
                  { resetAt: null },
                  { resetAt: { lt: resetBefore } },
                ],
              },
        },
      },
    });

    const affectedWorkspaceIds = new Set<number>();
    let resetUsageCount = 0;

    for (const quota of quotas) {
      for (const usage of quota.usage) {
        await prisma.usage.update({
          where: {
            workspaceId_quotaId: {
              workspaceId: usage.workspaceId,
              quotaId: quota.id,
            },
          },
          data: { value: 0, resetAt: currentDate },
        });

        resetUsageCount += 1;
        affectedWorkspaceIds.add(usage.workspaceId);
      }
    }

    await BillingContextService.refreshMany([...affectedWorkspaceIds]);

    return {
      policy,
      quotaCount: quotas.length,
      resetUsageCount,
      affectedWorkspaceCount: affectedWorkspaceIds.size,
      resetBefore,
    };
  }

  static async resetBillingCycleUsages(currentDate: Date) {
    const billingCycleQuotas = await prisma.quota.findMany({
      where: { resetPolicy: QuotaResetPolicy.BILLING_CYCLE },
      select: { id: true },
    });

    if (billingCycleQuotas.length === 0) {
      return {
        policy: QuotaResetPolicy.BILLING_CYCLE,
        resetCount: 0,
        affectedWorkspaceCount: 0,
      };
    }

    const quotaIds = billingCycleQuotas.map((q) => q.id);
    const affectedWorkspaceIds = new Set<number>();
    const targetDay = currentDate.getUTCDate();
    const lastDayOfCurrentMonth = new Date(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth() + 1,
      0,
    ).getUTCDate();
    const isEndOfMonth = targetDay === lastDayOfCurrentMonth;

    const subscriptions = await prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIAL"] } },
      select: { workspaceId: true, startsAt: true },
    });

    const workspacesToReset = subscriptions
      .filter((sub) => {
        const startDay = sub.startsAt.getUTCDate();
        return startDay === targetDay || (isEndOfMonth && startDay > targetDay);
      })
      .map((sub) => sub.workspaceId);

    if (workspacesToReset.length > 0) {
      await prisma.usage.updateMany({
        where: {
          workspaceId: { in: workspacesToReset },
          quotaId: { in: quotaIds },
        },
        data: { value: 0, resetAt: currentDate },
      });

      workspacesToReset.forEach((id) => affectedWorkspaceIds.add(id));
      await BillingContextService.refreshMany([...affectedWorkspaceIds]);
    }

    return {
      policy: QuotaResetPolicy.BILLING_CYCLE,
      resetCount: billingCycleQuotas.length,
      affectedWorkspaceCount: affectedWorkspaceIds.size,
    };
  }

  static async resetWorkspaceQuota(workspaceId: number, quotaKey?: string) {
    await UsageService.reset(workspaceId, quotaKey);
    await BillingContextService.refresh(workspaceId);
  }

  static async resetByPolicyForWorkspace(workspaceId: number, policy: QuotaResetPolicy) {
    const quotas = await prisma.quota.findMany({
      where: { resetPolicy: policy },
      select: { id: true },
    });

    if (quotas.length === 0) return;

    const quotaIds = quotas.map((q) => q.id);

    await prisma.usage.updateMany({
      where: {
        workspaceId,
        quotaId: { in: quotaIds },
      },
      data: {
        value: 0,
        resetAt: new Date(),
      },
    });

    await BillingContextService.refresh(workspaceId);
  }
}
