import { BillingCache } from "../types/billing-cache.type.ts";
import { PlanDefinition } from "../types/plan.type.ts";
import { InvalidPlanError } from "../errors/index.ts";

export class PlanValidator {
  static validateDefinition(definition: PlanDefinition): void {
    if (!definition.key || definition.version < 1) {
      throw new InvalidPlanError(definition.key || "unknown");
    }

    if (definition.trial.durationDays < 0) {
      throw new InvalidPlanError(definition.key);
    }

    const pricingKeys = new Set<string>();

    for (const pricing of definition.pricing) {
      if (!pricing.currency || pricing.amount <= 0) {
        throw new InvalidPlanError(definition.key);
      }

      const pricingKey = `${pricing.currency}:${pricing.billingCycle}`;

      if (pricingKeys.has(pricingKey)) {
        throw new InvalidPlanError(definition.key);
      }

      pricingKeys.add(pricingKey);
    }

    const featureKeys = Object.keys(definition.features);

    if (new Set(featureKeys).size !== featureKeys.length) {
      throw new InvalidPlanError(definition.key);
    }

    const quotaKeys = Object.keys(definition.quotas);

    if (new Set(quotaKeys).size !== quotaKeys.length) {
      throw new InvalidPlanError(definition.key);
    }

    for (const value of Object.values(definition.quotas)) {
      if (value !== null && (!Number.isInteger(value) || value < 0)) {
        throw new InvalidPlanError(definition.key);
      }
    }
  }

  static validateCache(cache: BillingCache): void {
    if (!cache.plan) {
      throw new InvalidPlanError("unknown");
    }
  }
}