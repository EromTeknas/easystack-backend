import { QuotaResetPolicy } from "@prisma/client";
import { prisma } from "../../../db";
import { UsageService } from "./usage.service.ts";
import { BillingContextService } from "../cache/billing.context.service.ts";

export class ResetService {
  // 1. The Main Cron Entry Point
  static async resetDueUsage(currentDate: Date = new Date()) {
    const results = [];
    const policiesToReset: QuotaResetPolicy[] = [];

    const resetTestMode = process.env.BILLING_RESET_TEST_MODE === "false";

    const isDailyResetWindow = currentDate.getUTCHours() === 0 && currentDate.getUTCMinutes() === 0;

    if (resetTestMode) {
      console.log("Billing reset test mode enabled: DAILY quotas reset on each run.");
      policiesToReset.push(QuotaResetPolicy.DAILY);
    } else if (isDailyResetWindow) {
      policiesToReset.push(QuotaResetPolicy.DAILY);
    }

    // Weekly: Reset on Monday (1)
    if (currentDate.getUTCDay() === 1) {
      policiesToReset.push(QuotaResetPolicy.WEEKLY);
    }

    // Monthly: Reset on the 1st of the month
    if (currentDate.getUTCDate() === 1) {
      policiesToReset.push(QuotaResetPolicy.MONTHLY);
    }

    // Execute the global calendar resets
    for (const policy of policiesToReset) {
      results.push(await this.resetByPolicy(policy));
    }

    // Execute workspace-specific billing cycle resets
    results.push(await this.resetBillingCycleUsages(currentDate));

    return results;
  }
  // 2. Helper to reset global calendar policies
  static async resetByPolicy(policy: QuotaResetPolicy) {
    const quotas = await prisma.quota.findMany({
      where: { resetPolicy: policy },
      include: { usage: true },
    });

    const affectedWorkspaceIds = new Set<number>();

    for (const quota of quotas) {
      for (const usage of quota.usage) {
        await prisma.usage.update({
          where: {
            workspaceId_quotaId: { workspaceId: usage.workspaceId, quotaId: quota.id },
          },
          data: { value: 0, resetAt: new Date() },
        });
        affectedWorkspaceIds.add(usage.workspaceId);
      }
    }

    await BillingContextService.refreshMany([...affectedWorkspaceIds]);

    return {
      policy,
      resetCount: quotas.length,
      affectedWorkspaceCount: affectedWorkspaceIds.size,
    };
  }

  // 3. Helper to reset workspace-specific Billing Cycle policies
  static async resetBillingCycleUsages(currentDate: Date) {
    // Get all quotas that follow the BILLING_CYCLE rule
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

    // Calculate dates to handle end-of-month edge cases (e.g., renewing on the 31st in a 30-day month)
    const targetDay = currentDate.getUTCDate();
    const lastDayOfCurrentMonth = new Date(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth() + 1,
      0,
    ).getUTCDate();
    const isEndOfMonth = targetDay === lastDayOfCurrentMonth;

    // Fetch active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIAL"] } },
      select: { workspaceId: true, startsAt: true },
    });

    // Filter workspaces whose anniversary is today
    const workspacesToReset = subscriptions
      .filter((sub) => {
        const startDay = sub.startsAt.getUTCDate();
        return startDay === targetDay || (isEndOfMonth && startDay > targetDay);
      })
      .map((sub) => sub.workspaceId);

    // Batch update the usages for these specific workspaces
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

  // 4. Reset a specific workspace (Used manually or via Webhooks)
  static async resetWorkspaceQuota(workspaceId: number, quotaKey?: string) {
    await UsageService.reset(workspaceId, quotaKey);
    await BillingContextService.refresh(workspaceId);
  }

  static async resetByPolicyForWorkspace(workspaceId: number, policy: QuotaResetPolicy) {
    // 1. Find all quotas that use this policy
    const quotas = await prisma.quota.findMany({
      where: { resetPolicy: policy },
      select: { id: true },
    });

    if (quotas.length === 0) return;

    const quotaIds = quotas.map((q) => q.id);

    // 2. Reset those specific usage rows for this workspace
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

    // 3. Flush the Redis cache so the workspace instantly sees its fresh limits
    await BillingContextService.refresh(workspaceId);
  }
}
