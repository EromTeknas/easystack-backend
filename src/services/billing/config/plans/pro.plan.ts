import { BillingCycles } from "../billing.config";
import { Features } from "../features.config";
import { Quotas } from "../quotas.config";
import { PlanDefinition } from "../../types/plan.type";

export const ProPlan: PlanDefinition = {
  key: "pro",
  version: 1,
  metadata: {
    displayName: "Pro",
    description: "For professionals and growing teams.",
    isPublic: true,
    isEnterprise: false,
    isActive: true,
    displayOrder: 2,
  },
  trial: {
    enabled: true,
    durationDays: 14,
  },
  pricing: [
    {
      currency: "INR",
      billingCycle: BillingCycles.MONTHLY,
      amount: 499,
      isDefault: true,
    },
    {
      currency: "INR",
      billingCycle: BillingCycles.YEARLY,
      amount: 4999,
      compareAtAmount: 5988,
    },
  ],
  features: {
    [Features.API_ACCESS.key]: true,
  },
  quotas: {
    [Quotas.PROJECTS.key]: 50,
  },
};