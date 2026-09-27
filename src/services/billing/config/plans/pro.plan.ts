import { Features, FeatureKey } from "../features.config";
import { Quotas } from "../quotas.config";
import { PlanDefinition } from "../../types/plan.type";

export const ProPlan: PlanDefinition = {
  key: "pro",
  version: 1,
  metadata: {
    displayName: "Pro",
    description: "Advanced features for growing teams.",
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
      currency: "USD",
      billingCycle: "MONTHLY",
      amount: 2000,
      isDefault: true,
    },
    {
      currency: "USD",
      billingCycle: "YEARLY",
      amount: 20000,
      compareAtAmount: 24000,
      isDefault: false,
    },
  ],
  features: {
    [Features.API_ACCESS.key]: true,
  },
  quotas: {
    // Workspace Scoped
    [Quotas.PROJECTS.key]: 10,
    [Quotas.MEMBERS.key]: 10,
    
    // Project Scoped
    [Quotas.FEEDS_PER_PROJECT.key]: 20,
  },
};
