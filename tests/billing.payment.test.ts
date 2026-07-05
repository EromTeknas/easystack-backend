import test from "node:test";
import assert from "node:assert/strict";

import { PaymentGateway } from "@prisma/client";

import { PaymentProviderFactory } from "../src/services/billing/payment/payment-provider.factory.ts";
import { InvoiceNumberGenerator } from "../src/services/billing/payment/invoice/invoice-number.generator.ts";

test("PaymentProviderFactory resolves Stripe by default", () => {
  const provider = PaymentProviderFactory.resolve();

  assert.equal(provider.gateway, PaymentGateway.STRIPE);
});

test("PaymentProviderFactory resolves Razorpay explicitly", () => {
  const provider = PaymentProviderFactory.resolve(PaymentGateway.RAZORPAY);

  assert.equal(provider.gateway, PaymentGateway.RAZORPAY);
});

test("InvoiceNumberGenerator produces invoice-like numbers", () => {
  const invoiceNumber = InvoiceNumberGenerator.generate();

  assert.match(invoiceNumber, /^INV-\d{14}-[A-Z0-9]{6}$/);
});