import { PaymentGateway, PaymentStatus } from "@prisma/client";

export interface PaymentResultDto {
  success: boolean;
  gateway: PaymentGateway;
  status: PaymentStatus;
  transactionId: string;
  customerId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}