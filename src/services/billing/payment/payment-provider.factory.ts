import { PaymentGateway } from "@prisma/client";

import { PaymentProvider } from "./payment-provider.interface.ts";
import { StripeProvider } from "./providers/stripe.provider.ts";
import { RazorpayProvider } from "./providers/razorpay.provider.ts";
import { PaddleProvider } from "./providers/paddle.provider.ts";

export class PaymentProviderFactory {
  static resolve(gateway: PaymentGateway = PaymentGateway.STRIPE): PaymentProvider {
    switch (gateway) {
      case PaymentGateway.RAZORPAY:
        return new RazorpayProvider();
      case PaymentGateway.PADDLE:
        return new PaddleProvider();
      case PaymentGateway.STRIPE:
      default:
        return new StripeProvider();
    }
  }
}