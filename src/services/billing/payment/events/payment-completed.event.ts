import { PaymentGateway } from "@prisma/client";

export interface PaymentCompletedEvent {
  userId: number;
  planKey: string;
  amount: number;
  currency: string;
  provider: PaymentGateway;
  transactionId: string;
}