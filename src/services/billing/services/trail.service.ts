import {
  Prisma,
  PrismaClient,
  SubscriptionStatus,
} from "@prisma/client";

import { SubscriptionRepository } from "../repositories/subscription.repository";
import { HistoryRepository } from "../repositories/history.repository";
import { BillingService } from "./billing.service.ts";
import { BillingContextService } from "../cache/billing.context.service.ts";

export class TrialService {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
    private readonly subscriptions = new SubscriptionRepository(prisma),
    private readonly history = new HistoryRepository(prisma),
  ) {}

  async expire(workspaceId: number) {
    const subscription = await this.subscriptions.findRaw(workspaceId);

    if (!subscription) {
      throw new Error("Subscription not found.");
    }

    if (subscription.status !== SubscriptionStatus.TRIAL) {
      return subscription;
    }

    const now = new Date();

    if (
      !subscription.trialEndsAt ||
      subscription.trialEndsAt > now
    ) {
      return subscription;
    }

    const updated = await this.subscriptions.update(workspaceId, {
      status: SubscriptionStatus.EXPIRED,
      expiresAt: now,
    });

    await this.history.create({
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

      status: SubscriptionStatus.EXPIRED,

      startsAt: subscription.startsAt,

      endsAt: now,

      reason: "Trial expired",
    });

    await BillingContextService.refresh(workspaceId);

    return updated;
  }

  async extend(workspaceId: number, days: number) {
    const subscription =
      await this.subscriptions.findRaw(workspaceId);

    if (!subscription) {
      throw new Error("Subscription not found.");
    }

    const base =
      subscription.trialEndsAt ?? new Date();

    const trialEndsAt = new Date(
      base.getTime() + days * 24 * 60 * 60 * 1000,
    );

    const updated = await this.subscriptions.update(workspaceId, {
      status: SubscriptionStatus.TRIAL,
      trialEndsAt,
    });

    await BillingContextService.refresh(workspaceId);

    return updated;
  }

  async isTrial(workspaceId: number) {
    const subscription =
      await this.subscriptions.findRaw(workspaceId);

    return subscription?.status === SubscriptionStatus.TRIAL;
  }
}
