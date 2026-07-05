import { PaymentGateway } from "@prisma/client";

import { PaymentProviderFactory } from "./payment-provider.factory.ts";
import { PurchasePlanDto } from "./dto/purchase-plan.dto.ts";
import { PaymentResultDto } from "./dto/payment-result.dto.ts";

export class PaymentService {
  constructor(private readonly factory = PaymentProviderFactory) {}

  resolveProvider(gateway?: PaymentGateway) {
    return this.factory.resolve(gateway ?? PaymentGateway.STRIPE);
  }

  async purchase(request: PurchasePlanDto): Promise<PaymentResultDto> {
    const provider = this.resolveProvider(request.gateway);
    return await provider.purchase(request);
  }

  async upgrade(request: PurchasePlanDto): Promise<PaymentResultDto> {
    const provider = this.resolveProvider(request.gateway);
    return await provider.upgrade(request);
  }

  async downgrade(request: PurchasePlanDto): Promise<PaymentResultDto> {
    const provider = this.resolveProvider(request.gateway);
    return await provider.downgrade(request);
  }

  async cancel(request: PurchasePlanDto): Promise<PaymentResultDto> {
    const provider = this.resolveProvider(request.gateway);
    return await provider.cancel(request);
  }

  async refund(request: PurchasePlanDto): Promise<PaymentResultDto> {
    const provider = this.resolveProvider(request.gateway);
    return await provider.refund(request);
  }

  /* Checkout helpers */
  async createCheckoutSession(request: PurchasePlanDto) {
    const provider = this.resolveProvider(request.gateway);
    return provider.createCheckoutSession?.(request);
  }

  async verifyPayment(gateway: PaymentGateway, payload: unknown) {
    const provider = this.resolveProvider(gateway);
    return provider.verifyPayment?.(payload);
  }

  async handleWebhook(gateway: PaymentGateway, payload: unknown) {
    const provider = this.resolveProvider(gateway);
    return provider.handleWebhook?.(payload);
  }
}