import { BillingCycle } from "../config/billing.config";
import { Currency } from "../config/currency.config";

export interface PricingDefinition {
  currency: Currency;
  billingCycle: BillingCycle;
  amount: number;
  compareAtAmount?: number;
  isDefault?: boolean;
}