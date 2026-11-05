import { Features, FeatureKey } from "../features.config";
import { Quotas } from "../quotas.config";
import { PlanDefinition } from "../../types/plan.type";

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
    // Workspace Scoped
    [Quotas.PROJECTS.key]: 2,
    [Quotas.API_REQUESTS.key]: 10,
    [Quotas.MEMBERS.key]: 3,
    
    // Project Scoped
    [Quotas.ENVIRONMENTS_PER_PROJECT.key]: 2,
    [Quotas.BLUEPRINTS_PER_PROJECT.key]: 5,
    [Quotas.DATA_ENTRIES_PER_PROJECT.key]: 100,
    [Quotas.FEEDS_PER_PROJECT.key]: 5,
  },
};
