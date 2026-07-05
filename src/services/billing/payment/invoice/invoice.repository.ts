import { Prisma, PrismaClient } from "@prisma/client";

export class InvoiceRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  create(data: Prisma.InvoiceCreateInput) {
    return this.prisma.invoice.create({ data });
  }

  findBySubscription(subscriptionId: number) {
    return this.prisma.invoice.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: "desc" },
    });
  }

  findByNumber(invoiceNumber: string) {
    return this.prisma.invoice.findUnique({ where: { invoiceNumber } });
  }
}