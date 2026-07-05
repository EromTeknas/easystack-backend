import { PrismaClient } from "@prisma/client";

import { InvoiceRepository } from "./invoice.repository.ts";
import { InvoiceNumberGenerator } from "./invoice-number.generator.ts";
import { InvoiceStatus } from "./invoice-status.enum.ts";
import { InvoiceType } from "./invoice-type.enum.ts";

export class InvoiceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly invoices = new InvoiceRepository(prisma),
  ) {}

  async create(input: {
    subscriptionId: number;
    paymentId: number;
    amount: number;
    currency: string;
    type?: InvoiceType;
    status?: InvoiceStatus;
    metadata?: Record<string, unknown>;
  }) {
    return await this.invoices.create({
      subscription: { connect: { id: input.subscriptionId } },
      payment: { connect: { id: input.paymentId } },
      invoiceNumber: InvoiceNumberGenerator.generate(),
      amount: input.amount,
      taxAmount: 0,
      total: input.amount,
      currency: input.currency,
      issuedAt: new Date(),
      metadata: {
        ...(input.metadata ?? {}),
        type: input.type ?? InvoiceType.PURCHASE,
        status: input.status ?? InvoiceStatus.PAID,
      },
    });
  }

  async listBySubscription(subscriptionId: number) {
    return await this.invoices.findBySubscription(subscriptionId);
  }
}