import { PaymentGateway } from "@prisma/client";

import { PaymentProviderFactory } from "./payment-provider.factory.ts";
import { PurchasePlanDto } from "./dto/purchase-plan.dto.ts";
import { PaymentResultDto } from "./dto/payment-result.dto.ts";

export class PaymentService {
  static async purchase(request: PurchasePlanDto): Promise<PaymentResultDto> {
    const provider = PaymentProviderFactory.resolve(request.gateway ?? PaymentGateway.STRIPE);
    return await provider.purchase(request);
  }

  static async upgrade(request: PurchasePlanDto): Promise<PaymentResultDto> {
    const provider = PaymentProviderFactory.resolve(request.gateway ?? PaymentGateway.STRIPE);
    return await provider.upgrade(request);
  }

  static async downgrade(request: PurchasePlanDto): Promise<PaymentResultDto> {
    const provider = PaymentProviderFactory.resolve(request.gateway ?? PaymentGateway.STRIPE);
    return await provider.downgrade(request);
  }

  static async cancel(request: PurchasePlanDto): Promise<PaymentResultDto> {
    const provider = PaymentProviderFactory.resolve(request.gateway ?? PaymentGateway.STRIPE);
    return await provider.cancel(request);
  }

  static async refund(request: PurchasePlanDto): Promise<PaymentResultDto> {
    const provider = PaymentProviderFactory.resolve(request.gateway ?? PaymentGateway.STRIPE);
    return await provider.refund(request);
  }
}