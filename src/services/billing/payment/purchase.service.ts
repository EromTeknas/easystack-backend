import { PaymentGateway, Prisma, PrismaClient, SubscriptionStatus } from "@prisma/client";

import { prisma } from "../../../db";
import { BillingContextService } from "../cache/billing.context.service.ts";
import { PlanRepository } from "../repositories/plan.repository.ts";
import { UsageService } from "../services/usage.service.ts";
import { SubscriptionRepository } from "../repositories/subscription.repository.ts";
import { HistoryRepository } from "../repositories/history.repository.ts";
import { PaymentService } from "./payment.service.ts";
import { InvoiceService } from "./invoice/invoice.service.ts";
import { BillingEvent } from "./events/billing-event.enum.ts";
import { PurchasePlanDto } from "./dto/purchase-plan.dto.ts";
import { PaymentResultDto } from "./dto/payment-result.dto.ts";
import { PaymentRepository } from "./payment.repository.ts";

export class PurchaseService {
  constructor(
    private readonly prismaClient: PrismaClient = prisma,
    private readonly plans = new PlanRepository(prisma),
    private readonly subscriptions = new SubscriptionRepository(prisma),
    private readonly history = new HistoryRepository(prisma),
    private readonly invoices = new InvoiceService(prisma),
    private readonly paymentRepo = new PaymentRepository(prisma),
  ) {}

  async purchase(request: PurchasePlanDto) {
    const plan = await this.plans.findLatestVersion(request.planKey);

    if (!plan) {
      throw new Error(`Plan '${request.planKey}' not found.`);
    }

    // Idempotency: check if we already processed this idempotency key
    if (request.idempotencyKey) {
      const existing = await this.paymentRepo.findByIdempotencyKey(request.idempotencyKey);

      if (existing) {
        return { success: true, payment: existing } as any;
      }
    }

    const paymentService = new PaymentService();

    // Perform external payment operation (mock or gateway). This happens BEFORE the DB transaction,
    // but the DB persistence of subscription/payment/invoice is transactional.
    const payment = await paymentService.purchase({
      ...request,
      gateway: request.gateway ?? PaymentGateway.STRIPE,
      amount: request.amount ?? Number(plan.pricing.find((pricing) => pricing.isDefault)?.amount ?? 0),
      currency: request.currency ?? plan.pricing.find((pricing) => pricing.isDefault)?.currency ?? "INR",
      metadata: {
        ...(request.metadata ?? {}),
        planVersionId: plan.id,
        billingEvent: BillingEvent.PAYMENT_SUCCESS,
        idempotencyKey: request.idempotencyKey ?? null,
      },
    });

    // If payment did not succeed, persist a payment record and return status.
    if (payment.status !== ("PAID" as any)) {
      await this.paymentRepo.create({
        subscription: undefined as any,
        gateway: payment.gateway,
        gatewayPaymentId: payment.transactionId,
        gatewayCustomerId: payment.customerId ?? undefined,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status as any,
        paidAt: payment.status === ("PAID" as any) ? new Date() : null,
        metadata: (payment.metadata ?? {}) as Prisma.InputJsonValue,
      } as Prisma.PaymentCreateInput);

      return { success: false, payment } as any;
    }

    // Payment succeeded: persist everything inside a DB transaction.
    const result = await this.prismaClient.$transaction(async (tx) => {
      // 1) create / upsert subscription (without refreshing cache here)
      const startsAt = new Date();
      let status = SubscriptionStatus.ACTIVE as SubscriptionStatus;
      let trialEndsAt: Date | null = null;

      if (plan.trial?.enabled) {
        status = SubscriptionStatus.TRIAL as SubscriptionStatus;
        trialEndsAt = new Date(startsAt.getTime() + plan.trial.durationDays * 24 * 60 * 60 * 1000);
      }

      const subRepo = new SubscriptionRepository(tx as any);
      const historyRepo = new HistoryRepository(tx as any);
      const paymentRepoTx = new PaymentRepository(tx as any);
      const invoiceSvcTx = new InvoiceService(tx as any);

      const subscription = await subRepo.upsert(
        request.userId,
        {
          user: { connect: { id: request.userId } },
          planVersion: { connect: { id: plan.id } },
          status,
          startsAt,
          trialEndsAt,
          expiresAt: null,
          gateway: payment.gateway,
          gatewayCustomerId: payment.customerId ?? null,
          gatewaySubscriptionId: payment.subscriptionId ?? null,
        } as any,
        {
          planVersion: { connect: { id: plan.id } },
          status,
          startsAt,
          trialEndsAt,
          expiresAt: null,
          gateway: payment.gateway,
          gatewayCustomerId: payment.customerId ?? null,
          gatewaySubscriptionId: payment.subscriptionId ?? null,
        } as any,
      );

      await historyRepo.create({
        subscription: { connect: { id: subscription.id } },
        planVersion: { connect: { id: plan.id } },
        status,
        startsAt,
        endsAt: null,
        reason: "Purchase completed",
      } as any);

      // 2) create payment record
      const paymentRecord = await paymentRepoTx.create({
        subscription: { connect: { id: subscription.id } },
        gateway: payment.gateway,
        gatewayPaymentId: payment.transactionId,
        gatewayCustomerId: payment.customerId ?? undefined,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status as any,
        paidAt: new Date(),
        metadata: (payment.metadata ?? {}) as Prisma.InputJsonValue,
      } as Prisma.PaymentCreateInput);

      // 3) create invoice
      const invoice = await invoiceSvcTx.create({
        subscriptionId: subscription.id,
        paymentId: paymentRecord.id,
        amount: payment.amount,
        currency: payment.currency,
        metadata: {
          planKey: request.planKey,
          gateway: payment.gateway,
          gatewayTransactionId: payment.transactionId,
          billingEvent: BillingEvent.INVOICE_CREATED,
        },
      });

      // 4) initialize usage rows inside transaction
      const quotaKeys = Object.keys(plan.quotas ?? {});

      if (quotaKeys.length > 0) {
        const quotas = await tx.quota.findMany({ where: { key: { in: quotaKeys } } });

        for (const quota of quotas) {
          await tx.usage.upsert({
            where: { userId_quotaId: { userId: request.userId, quotaId: quota.id } },
            create: { userId: request.userId, quotaId: quota.id, value: 0 },
            update: { value: 0 },
          });
        }
      }

      return { subscription, payment: paymentRecord, invoice };
    });

    // Refresh cache AFTER commit
    await BillingContextService.refresh(request.userId);

    // Ensure Redis usage seeds
    await UsageService.initialize(request.userId, plan.id);

    return { success: true, ...result };
  }

  async upgrade(request: PurchasePlanDto) {
    // TODO: Upgrade should preserve gateway customer & subscription and update gateway subscription.
    // For now we route through purchase() to keep behavior simple.
    return await this.purchase(request);
  }

  async downgrade(request: PurchasePlanDto) {
    // TODO: Downgrade should schedule at period end instead of creating a new subscription.
    // For now we route through purchase() to keep behavior simple.
    return await this.purchase(request);
  }

  async cancel(request: PurchasePlanDto) {
    const subscription = await this.subscriptions.findRaw(request.userId);

    if (!subscription) {
      throw new Error("Subscription not found.");
    }

    const now = new Date();

    await this.subscriptions.update(request.userId, {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: now,
    } as any);

    await this.history.create({
      subscription: { connect: { id: subscription.id } },
      planVersion: { connect: { id: subscription.planVersionId } },
      status: SubscriptionStatus.CANCELLED,
      startsAt: subscription.startsAt,
      endsAt: now,
      reason: "Cancelled",
    } as any);

    await BillingContextService.refresh(request.userId);

    return { success: true };
  }
}