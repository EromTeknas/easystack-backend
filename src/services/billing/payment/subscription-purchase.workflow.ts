import { PaymentGateway, PaymentStatus, Prisma, PrismaClient, SubscriptionStatus } from "@prisma/client";
import { InvoiceService } from "./invoice/invoice.service.ts";
import { PaymentRepository } from "./payment.repository.ts";
import { SubscriptionRepository } from "../repositories/subscription.repository.ts";
import { HistoryRepository } from "../repositories/history.repository.ts";

export class SubscriptionPurchaseWorkflow {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(args: {
    workspaceId: number;
    billingOwnerId?: number;
    planId: number;
    paymentResult: { gateway: PaymentGateway; transactionId: string; customerId?: string; subscriptionId?: string; amount: number; currency: string; metadata?: Record<string, unknown> | undefined };
  }) {
    const { workspaceId, billingOwnerId, planId, paymentResult } = args;

    return await this.prisma.$transaction(async (tx) => {
      const subRepo = new SubscriptionRepository(tx);
      const historyRepo = new HistoryRepository(tx);
      const paymentRepo = new PaymentRepository(tx);
      const invoiceSvc = new InvoiceService(tx);

      const startsAt = new Date();
      const status = SubscriptionStatus.ACTIVE;
      const trialEndsAt: Date | null = null;

      // Plan trial handling is done by caller if required; keep basic active

      const subscription = await subRepo.upsert(
        workspaceId,
        {
          workspace: { connect: { id: workspaceId } },
          ...(billingOwnerId ? { billingOwner: { connect: { id: billingOwnerId } } } : {}),
          planVersion: { connect: { id: planId } },
          status,
          startsAt,
          trialEndsAt,
          expiresAt: null,
          gateway: paymentResult.gateway,
          gatewayCustomerId: paymentResult.customerId ?? null,
          gatewaySubscriptionId: paymentResult.subscriptionId ?? null,
        },
        {
          planVersion: { connect: { id: planId } },
          billingOwner: billingOwnerId ? { connect: { id: billingOwnerId } } : { disconnect: true },
          status,
          startsAt,
          trialEndsAt,
          expiresAt: null,
          gateway: paymentResult.gateway,
          gatewayCustomerId: paymentResult.customerId ?? null,
          gatewaySubscriptionId: paymentResult.subscriptionId ?? null,
        },
      );

      await historyRepo.create({
        workspace: { connect: { id: workspaceId } },
        subscription: { connect: { id: subscription.id } },
        planVersion: { connect: { id: planId } },
        status,
        startsAt,
        endsAt: null,
        reason: "Purchase completed",
      });

      const paymentRecord = await paymentRepo.create({
        workspace: { connect: { id: workspaceId } },
        subscription: { connect: { id: subscription.id } },
        gateway: paymentResult.gateway,
        gatewayPaymentId: paymentResult.transactionId,
        gatewayCustomerId: paymentResult.customerId ?? undefined,
        gatewayPriceId: typeof paymentResult.metadata?.gatewayPriceId === "string" ? paymentResult.metadata.gatewayPriceId : undefined,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        metadata: (paymentResult.metadata ?? {}) as Prisma.InputJsonValue,
        idempotencyKey: (paymentResult.metadata?.idempotencyKey as string) ?? undefined,
      } as Prisma.PaymentCreateInput);

      const invoice = await invoiceSvc.create({
        workspaceId,
        subscriptionId: subscription.id,
        paymentId: paymentRecord.id,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        metadata: {
          gateway: paymentResult.gateway,
          gatewayTransactionId: paymentResult.transactionId,
        },
      });

      // Initialize usage rows
      const planVersion = await tx.planVersion.findUnique({
        where: { id: planId },
        include: { quotas: true },
      });

      if (planVersion?.quotas.length) {
        for (const quota of planVersion.quotas) {
          await tx.usage.upsert({
            where: { workspaceId_quotaId: { workspaceId, quotaId: quota.quotaId } },
            create: { workspaceId, quotaId: quota.quotaId, value: 0 },
            update: { value: 0 },
          });
        }
      }

      return { subscription, payment: paymentRecord, invoice };
    });
  }
}
