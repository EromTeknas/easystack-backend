import { Prisma, PrismaClient, SubscriptionStatus } from "@prisma/client";
import { InvoiceService } from "./invoice/invoice.service.ts";
import { PaymentRepository } from "./payment.repository.ts";
import { SubscriptionRepository } from "../repositories/subscription.repository.ts";
import { HistoryRepository } from "../repositories/history.repository.ts";

export class SubscriptionPurchaseWorkflow {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(args: {
    userId: number;
    planId: number;
    paymentResult: { gateway: any; transactionId: string; customerId?: string; subscriptionId?: string; amount: number; currency: string; metadata?: Record<string, unknown> | undefined };
  }) {
    const { userId, planId, paymentResult } = args;

    return await this.prisma.$transaction(async (tx) => {
      const subRepo = new SubscriptionRepository(tx as any);
      const historyRepo = new HistoryRepository(tx as any);
      const paymentRepo = new PaymentRepository(tx as any);
      const invoiceSvc = new InvoiceService(tx as any);

      const startsAt = new Date();
      let status = SubscriptionStatus.ACTIVE as SubscriptionStatus;
      let trialEndsAt: Date | null = null;

      // Plan trial handling is done by caller if required; keep basic active

      const subscription = await subRepo.upsert(
        userId,
        {
          user: { connect: { id: userId } },
          planVersion: { connect: { id: planId } },
          status,
          startsAt,
          trialEndsAt,
          expiresAt: null,
          gateway: paymentResult.gateway,
          gatewayCustomerId: paymentResult.customerId ?? null,
          gatewaySubscriptionId: paymentResult.subscriptionId ?? null,
        } as any,
        {
          planVersion: { connect: { id: planId } },
          status,
          startsAt,
          trialEndsAt,
          expiresAt: null,
          gateway: paymentResult.gateway,
          gatewayCustomerId: paymentResult.customerId ?? null,
          gatewaySubscriptionId: paymentResult.subscriptionId ?? null,
        } as any,
      );

      await historyRepo.create({
        subscription: { connect: { id: subscription.id } },
        planVersion: { connect: { id: planId } },
        status,
        startsAt,
        endsAt: null,
        reason: "Purchase completed",
      } as any);

      const paymentRecord = await paymentRepo.create({
        subscription: { connect: { id: subscription.id } },
        gateway: paymentResult.gateway,
        gatewayPaymentId: paymentResult.transactionId,
        gatewayCustomerId: paymentResult.customerId ?? undefined,
        gatewayPriceId: paymentResult.metadata?.gatewayPriceId as any,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        status: ("PAID" as any),
        paidAt: new Date(),
        metadata: (paymentResult.metadata ?? {}) as Prisma.InputJsonValue,
        idempotencyKey: (paymentResult.metadata?.idempotencyKey as string) ?? undefined,
      } as Prisma.PaymentCreateInput);

      const invoice = await invoiceSvc.create({
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
      const quotaKeys = Object.keys((await tx.planVersion.findUnique({ where: { id: planId }, include: { quotas: true } }))?.quotas ?? {});

      if (quotaKeys.length > 0) {
        const quotas = await tx.quota.findMany({ where: { key: { in: quotaKeys } } });

        for (const quota of quotas) {
          await tx.usage.upsert({
            where: { userId_quotaId: { userId, quotaId: quota.id } },
            create: { userId, quotaId: quota.id, value: 0 },
            update: { value: 0 },
          });
        }
      }

      return { subscription, payment: paymentRecord, invoice };
    });
  }
}
