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
    // MySQL JSON_EXTRACT usage; use a raw query to find metadata->idempotencyKey
    const rows: any[] = await (this.prisma as PrismaClient).$queryRaw`
      SELECT * FROM payment WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.idempotencyKey')) = ${idempotencyKey} LIMIT 1
    `;

    return rows.length ? (rows[0] as Payment) : null;
  }
}
