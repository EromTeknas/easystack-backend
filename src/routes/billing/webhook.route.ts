import express from "express";
import { WebhookService } from "../../services/billing/payment/webhook.service.ts";
import { PaymentGateway } from "@prisma/client";

const router = express.Router();
const webhookService = new WebhookService();

// Generic webhook endpoint: gateway param identifies provider
router.post("/:gateway", async (req, res) => {
  const gatewayParam = (req.params.gateway ?? "stripe").toUpperCase();
  const gateway = PaymentGateway[gatewayParam as keyof typeof PaymentGateway] as PaymentGateway;

  try {
    await webhookService.handle(gateway, req.body);
    res.status(204).send();
  } catch (err) {
    console.error("Webhook handling error:", err);
    res.status(500).json({ success: false });
  }
});

export default router;
