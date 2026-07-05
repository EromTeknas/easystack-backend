import { PaymentGateway, BillingCycle } from "@prisma/client";

export interface PurchasePlanDto {
  userId: number;
  planKey: string;
  gateway?: PaymentGateway;
  currency?: string;
  billingCycle?: BillingCycle;
  amount?: number;
  metadata?: Record<string, unknown>;
  // Optional idempotency key to dedupe duplicate requests
  idempotencyKey?: string;
}