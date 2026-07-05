import { PaymentGateway } from "@prisma/client";

import { MockPaymentProvider } from "./mock-payment.provider.ts";

export class StripeProvider extends MockPaymentProvider {
  readonly gateway = PaymentGateway.STRIPE;
}