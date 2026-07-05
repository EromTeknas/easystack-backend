import { PaymentGateway } from "@prisma/client";

export interface PurchasePlanDto {
  userId: number;
  planKey: string;
  gateway?: PaymentGateway;
  currency?: string;
  billingCycle?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}