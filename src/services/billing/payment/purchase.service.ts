import { PaymentGateway, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../../../db";
import { BillingContextService } from "../cache/billing.context.service.ts";
import { PlanRepository } from "../repositories/plan.repository.ts";
import { UsageService } from "../services/usage.service.ts";
import { SubscriptionService } from "../services/subscription.service.ts";
import { PaymentService } from "./payment.service.ts";
import { InvoiceService } from "./invoice/invoice.service.ts";
import { BillingEvent } from "./events/billing-event.enum.ts";
import { PurchasePlanDto } from "./dto/purchase-plan.dto.ts";
import { PaymentResultDto } from "./dto/payment-result.dto.ts";

export class PurchaseService {
  constructor(
    private readonly prismaClient: PrismaClient = prisma,
    private readonly plans = new PlanRepository(prisma),
    private readonly subscriptions = new SubscriptionService(prisma),
    private readonly invoices = new InvoiceService(prisma),
  ) {}

  async purchase(request: PurchasePlanDto) {
    const plan = await this.plans.findLatestVersion(request.planKey);

    if (!plan) {
      throw new Error(`Plan '${request.planKey}' not found.`);
    }

    const payment = await PaymentService.purchase({
      ...request,
      gateway: request.gateway ?? PaymentGateway.STRIPE,
      amount: request.amount ?? Number(plan.pricing.find((pricing) => pricing.isDefault)?.amount ?? 0),
      currency: request.currency ?? plan.pricing.find((pricing) => pricing.isDefault)?.currency ?? "INR",
      metadata: {
        ...(request.metadata ?? {}),
        planVersionId: plan.id,
        billingEvent: BillingEvent.PAYMENT_SUCCESS,
      },
    });

    const subscription = await this.subscriptions.assignPlan(request.userId, request.planKey, {
      gateway: payment.gateway,
      gatewayCustomerId: payment.customerId,
      gatewaySubscriptionId: payment.subscriptionId,
      reason: "Purchase completed",
    });

    await UsageService.initialize(request.userId, plan.id);
    await BillingContextService.refresh(request.userId);

    const invoice = await this.invoices.create({
      subscriptionId: subscription.id,
      paymentId: await this.ensurePaymentRecord(payment, subscription.id),
      amount: payment.amount,
      currency: payment.currency,
      metadata: {
        planKey: request.planKey,
        gateway: payment.gateway,
        gatewayTransactionId: payment.transactionId,
        billingEvent: BillingEvent.INVOICE_CREATED,
      },
    });

    return {
      success: true,
      payment,
      subscription,
      invoice,
    };
  }

  async upgrade(request: PurchasePlanDto) {
    return await this.purchase(request);
  }

  async downgrade(request: PurchasePlanDto) {
    return await this.purchase(request);
  }

  async cancel(request: PurchasePlanDto) {
    return await this.subscriptions.cancel(request.userId, "Purchase cancelled");
  }

  private async ensurePaymentRecord(payment: PaymentResultDto, subscriptionId: number) {
    const record = await this.prismaClient.payment.create({
      data: {
        subscription: { connect: { id: subscriptionId } },
        gateway: payment.gateway,
        gatewayPaymentId: payment.transactionId,
        gatewayCustomerId: payment.customerId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paidAt: new Date(),
        metadata: (payment.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    return record.id;
  }
}