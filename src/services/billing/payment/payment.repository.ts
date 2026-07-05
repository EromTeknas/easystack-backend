import { Prisma, PrismaClient, Payment } from "@prisma/client";

export class PaymentRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  create(data: Prisma.PaymentCreateInput) {
    return this.prisma.payment.create({ data });
  }

  update(id: number, data: Prisma.PaymentUpdateInput) {
    return this.prisma.payment.update({ where: { id }, data });
  }

  findByTransaction(gatewayPaymentId: string) {
    return this.prisma.payment.findFirst({ where: { gatewayPaymentId } });
  }

  findBySubscription(subscriptionId: number) {
    return this.prisma.payment.findMany({ where: { subscriptionId }, orderBy: { createdAt: "desc" } });
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    if (!idempotencyKey) return null;

    // Try direct column lookup via raw SQL to avoid Prisma type mismatches if client not regenerated yet
    try {
      const rows: any[] = await (this.prisma as PrismaClient).$queryRaw`
        SELECT * FROM payment WHERE idempotencyKey = ${idempotencyKey} LIMIT 1
      `;

      if (rows.length) return rows[0] as Payment;
    } catch (err) {
      // ignore and fallback
    }

    // Fallback: older schema, try JSON_EXTRACT on metadata
    const rows: any[] = await (this.prisma as PrismaClient).$queryRaw`
      SELECT * FROM payment WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.idempotencyKey')) = ${idempotencyKey} LIMIT 1
    `;

    return rows.length ? (rows[0] as Payment) : null;
  }
}
