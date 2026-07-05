import { PaymentGateway } from "@prisma/client";
import { PaymentService } from "./payment.service.ts";

export class WebhookService {
  constructor(private readonly payments = new PaymentService()) {}

  async handle(gateway: PaymentGateway, payload: unknown) {
    // Delegate to provider-specific webhook handler (mock logs by default)
    await this.payments.handleWebhook(gateway, payload);
  }
}
