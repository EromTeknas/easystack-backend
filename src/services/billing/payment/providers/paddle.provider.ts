import { PaymentGateway } from "@prisma/client";

import { MockPaymentProvider } from "./mock-payment.provider.ts";

export class PaddleProvider extends MockPaymentProvider {
  readonly gateway = PaymentGateway.PADDLE;
}