import { PaymentGateway, PaymentStatus, Prisma, PrismaClient, SubscriptionStatus } from "@prisma/client";

import { prisma } from "../../../db";
import { BillingContextService } from "../cache/billing.context.service.ts";
import { PlanRepository } from "../repositories/plan.repository.ts";
import { UsageService } from "../services/usage.service.ts";
import { SubscriptionRepository } from "../repositories/subscription.repository.ts";
import { HistoryRepository } from "../repositories/history.repository.ts";
import { SubscriptionPurchaseWorkflow } from "./subscription-purchase.workflow.ts";
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
        return { success: true, payment: existing };
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
    if (payment.status !== PaymentStatus.PAID) {
      await this.paymentRepo.create({
        workspace: { connect: { id: request.workspaceId } },
        gateway: payment.gateway,
        gatewayPaymentId: payment.transactionId,
        gatewayCustomerId: payment.customerId ?? undefined,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paidAt: null,
        metadata: (payment.metadata ?? {}) as Prisma.InputJsonValue,
      });

      return { success: false, payment };
    }

    // Payment succeeded: hand over to the workflow which encapsulates the DB transaction.
    const workflow = new SubscriptionPurchaseWorkflow(this.prismaClient);

    const result = await workflow.execute({
      workspaceId: request.workspaceId,
      ...(request.billingOwnerId ? { billingOwnerId: request.billingOwnerId } : {}),
      planId: plan.id,
      paymentResult: {
        gateway: payment.gateway,
        transactionId: payment.transactionId,
        ...(payment.customerId ? { customerId: payment.customerId } : {}),
        ...(payment.subscriptionId ? { subscriptionId: payment.subscriptionId } : {}),
        amount: payment.amount,
        currency: payment.currency,
        ...(payment.metadata ? { metadata: payment.metadata as Record<string, unknown> } : {}),
      },
    });

    // Refresh cache AFTER commit
    await BillingContextService.refresh(request.workspaceId);

    // Ensure Redis usage seeds
    await UsageService.initialize(request.workspaceId, plan.id);

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
    const subscription = await this.subscriptions.findRaw(request.workspaceId);

    if (!subscription) {
      throw new Error("Subscription not found.");
    }

    const now = new Date();

    await this.subscriptions.update(request.workspaceId, {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: now,
    });

    await this.history.create({
      workspace: { connect: { id: request.workspaceId } },
      subscription: { connect: { id: subscription.id } },
      planVersion: { connect: { id: subscription.planVersionId } },
      status: SubscriptionStatus.CANCELLED,
      startsAt: subscription.startsAt,
      endsAt: now,
      reason: "Cancelled",
    });

    await BillingContextService.refresh(request.workspaceId);

    return { success: true };
  }
}
