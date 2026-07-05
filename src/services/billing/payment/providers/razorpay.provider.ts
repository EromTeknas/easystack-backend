import { PaymentGateway } from "@prisma/client";

import { MockPaymentProvider } from "./mock-payment.provider.ts";

export class RazorpayProvider extends MockPaymentProvider {
  readonly gateway = PaymentGateway.RAZORPAY;
}