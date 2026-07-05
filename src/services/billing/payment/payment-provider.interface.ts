import { PaymentGateway } from "@prisma/client";

import { PurchasePlanDto } from "./dto/purchase-plan.dto.ts";
import { PaymentResultDto } from "./dto/payment-result.dto.ts";

export interface PaymentProvider {
  readonly gateway: PaymentGateway;

  purchase(request: PurchasePlanDto): Promise<PaymentResultDto>;

  upgrade(request: PurchasePlanDto): Promise<PaymentResultDto>;

  downgrade(request: PurchasePlanDto): Promise<PaymentResultDto>;

  cancel(request: PurchasePlanDto): Promise<PaymentResultDto>;

  refund(request: PurchasePlanDto): Promise<PaymentResultDto>;
}