import { randomUUID } from "node:crypto";

import { PaymentGateway, PaymentStatus } from "@prisma/client";

import { PurchasePlanDto } from "../dto/purchase-plan.dto.ts";
import { PaymentResultDto } from "../dto/payment-result.dto.ts";
import { PaymentProvider } from "../payment-provider.interface.ts";

export abstract class MockPaymentProvider implements PaymentProvider {
  abstract readonly gateway: PaymentGateway;

  async purchase(request: PurchasePlanDto): Promise<PaymentResultDto> {
    return this.createSuccessResult(request, "purchase");
  }

  async upgrade(request: PurchasePlanDto): Promise<PaymentResultDto> {
    return this.createSuccessResult(request, "upgrade");
  }

  async downgrade(request: PurchasePlanDto): Promise<PaymentResultDto> {
    return this.createSuccessResult(request, "downgrade");
  }

  async cancel(request: PurchasePlanDto): Promise<PaymentResultDto> {
    return this.createSuccessResult(request, "cancel");
  }

  async refund(request: PurchasePlanDto): Promise<PaymentResultDto> {
    return this.createSuccessResult(request, "refund");
  }

  protected createSuccessResult(
    request: PurchasePlanDto,
    event: string,
  ): PaymentResultDto {
    const transactionId = randomUUID();
    const customerId = randomUUID();
    const subscriptionId = randomUUID();
    const amount = request.amount ?? 0;
    const currency = request.currency ?? "INR";

    console.log(`Payment successful via ${this.gateway} (${event})`, {
      userId: request.userId,
      planKey: request.planKey,
      transactionId,
      customerId,
      subscriptionId,
      amount,
      currency,
    });

    return {
      success: true,
      gateway: this.gateway,
      status: PaymentStatus.PAID,
      transactionId,
      customerId,
      subscriptionId,
      amount,
      currency,
      ...(request.metadata ? { metadata: request.metadata } : {}),
    };
  }
}