import { BillingCycles } from "../billing.config";
import { Features, FeatureKey } from "../features.config";
import { Quotas } from "../quotas.config";
import { PlanDefinition } from "../../types/plan.type";
import { FEATURE_KEYS } from "../../../../constants";

export const FreePlan: PlanDefinition = {
  key: "free",
  version: 1,
  metadata: {
    displayName: "Always Free",
    description: "Perfect for individuals getting started.",
    isPublic: true,
    isEnterprise: false,
    isActive: true,
    displayOrder: 1,
  },
  trial: {
    enabled: false,
    durationDays: 0,
  },
  pricing: [],
  features: {
    [Features.API_ACCESS.key]: true,
  },
  quotas: {
    [Quotas.PROJECTS.key]: 1,
  },
};