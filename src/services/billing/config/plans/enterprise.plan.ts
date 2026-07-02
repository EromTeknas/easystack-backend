import { FeatureKey, Features } from "../features.config";
import { QuotaKey, Quotas } from "../quotas.config";
import { PlanDefinition } from "../../types/plan.type";

export const EnterprisePlan: PlanDefinition = {
  key: "enterprise",
  version: 1,
  metadata: {
    displayName: "Enterprise",
    description: "Custom solutions for large organizations.",
    isPublic: false,
    isEnterprise: true,
    isActive: true,
    displayOrder: 3,
  },
  trial: {
    enabled: false,
    durationDays: 0,
  },
  pricing: [],
  features: Object.values(Features).reduce(
    (acc, feature) => {
      acc[feature.key] = true;
      return acc;
    },
    {} as Record<FeatureKey, boolean>,
  ),
  quotas: Object.values(Quotas).reduce(
    (acc, quota) => {
      acc[quota.key] = null;
      return acc;
    },
    {} as Record<QuotaKey, null>,
  ),
};