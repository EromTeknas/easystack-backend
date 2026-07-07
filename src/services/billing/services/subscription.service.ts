import { PaymentGateway, Prisma, PrismaClient, SubscriptionStatus } from "@prisma/client";

import { SubscriptionRepository } from "../repositories/subscription.repository";
import { HistoryRepository } from "../repositories/history.repository";
import { PlanRepository } from "../repositories/plan.repository";
import { BillingService } from "./billing.service.ts";
import { BillingContextService } from "../cache/billing.context.service.ts";

export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
    private readonly subscriptions = new SubscriptionRepository(prisma),
    private readonly historyRepo = new HistoryRepository(prisma),
    private readonly plans = new PlanRepository(prisma),
  ) {}

  async get(workspaceId: number) {
    return BillingService.subscription(workspaceId);
  }

  async exists(workspaceId: number) {
    return !!(await BillingService.subscription(workspaceId));
  }

  async assignPlan(
    workspaceId: number,
    planKey: string,
    options?: {
      trial?: boolean;
      reason?: string;
      gateway?: PaymentGateway;
      gatewayCustomerId?: string;
      gatewaySubscriptionId?: string;
      billingOwnerId?: number;
    },
  ) {
    const plan = await this.plans.findLatestVersion(planKey);

    if (!plan) {
      throw new Error(`Plan '${planKey}' not found.`);
    }

    const startsAt = new Date();

    let status = SubscriptionStatus.ACTIVE as SubscriptionStatus;

    let trialEndsAt: Date | null = null;

    if (options?.trial && plan.trial?.enabled) {
      status = SubscriptionStatus.TRIAL as SubscriptionStatus;

      trialEndsAt = new Date(
        startsAt.getTime() + plan.trial.durationDays * 24 * 60 * 60 * 1000,
      );
    }

    const subscription = await this.subscriptions.upsert(
      workspaceId,
      {
        workspace: {
          connect: {
            id: workspaceId,
          },
        },
        ...(options?.billingOwnerId
          ? { billingOwner: { connect: { id: options.billingOwnerId } } }
          : {}),

        planVersion: {
          connect: {
            id: plan.id,
          },
        },

        status,
        startsAt,
        trialEndsAt,
        expiresAt: null,

        gateway: options?.gateway ? options.gateway : null,
        gatewayCustomerId: options?.gatewayCustomerId ?? null,
        gatewaySubscriptionId: options?.gatewaySubscriptionId ?? null,
      },
      {
        planVersion: {
          connect: {
            id: plan.id,
          },
        },
        status,
        startsAt,
        trialEndsAt,
        expiresAt: null,

        gateway: options?.gateway ? options.gateway : null,
        gatewayCustomerId: options?.gatewayCustomerId ?? null,
        gatewaySubscriptionId: options?.gatewaySubscriptionId ?? null,
        billingOwner: options?.billingOwnerId
          ? { connect: { id: options.billingOwnerId } }
          : { disconnect: true },
      },
    );

    await this.historyRepo.create({
      workspace: {
        connect: {
          id: workspaceId,
        },
      },
      subscription: {
        connect: {
          id: subscription.id,
        },
      },

      planVersion: {
        connect: {
          id: plan.id,
        },
      },

      status,

      startsAt,

      endsAt: null,

      reason: options?.reason ?? "Subscription assigned",
    });

    await BillingContextService.refresh(workspaceId);

    return subscription;
  }

  async cancel(workspaceId: number, reason?: string) {
    const subscription = await this.subscriptions.findRaw(workspaceId);

    if (!subscription) {
      throw new Error("Subscription not found.");
    }

    const now = new Date();

    const updated = await this.subscriptions.update(workspaceId, {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: now,
    });

    await this.historyRepo.create({
      workspace: {
        connect: {
          id: workspaceId,
        },
      },
      subscription: {
        connect: {
          id: subscription.id,
        },
      },

      planVersion: {
        connect: {
          id: subscription.planVersionId,
        },
      },

      status: SubscriptionStatus.CANCELLED,

      startsAt: subscription.startsAt,

      endsAt: now,

      reason: reason ?? "Cancelled",
    });

    await BillingContextService.refresh(workspaceId);

    return updated;
  }

  async history(workspaceId: number) {
    const subscription = await this.subscriptions.findRaw(workspaceId);

    if (!subscription) {
      return [];
    }

    return this.historyRepo.findBySubscription(subscription.id);
  }
}
