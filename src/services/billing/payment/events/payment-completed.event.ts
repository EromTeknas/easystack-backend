import { PaymentGateway } from "@prisma/client";

export interface PaymentCompletedEvent {
  workspaceId: number;
  planKey: string;
  amount: number;
  currency: string;
  provider: PaymentGateway;
  transactionId: string;
}
