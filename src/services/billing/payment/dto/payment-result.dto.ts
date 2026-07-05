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

  // Optional convenience URLs and gateway identifiers
  checkoutUrl?: string;
  invoiceUrl?: string;
  receiptUrl?: string;
  gatewayInvoiceId?: string;
  gatewayPriceId?: string;
  expiresAt?: Date | string;
}