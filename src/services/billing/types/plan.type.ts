import { FeatureKey } from "../config/features.config";
import { QuotaKey } from "../config/quotas.config";
import { PricingDefinition } from "./pricing.type";

export interface PlanDefinition {
  key: string;
  version: number;
  metadata: {
    displayName: string;
    description: string;
    isPublic: boolean;
    isEnterprise: boolean;
    isActive: boolean;
    displayOrder: number;
  };
  trial: {
    enabled: boolean;
    durationDays: number;
  };
  pricing: PricingDefinition[];
  features: Partial<Record<FeatureKey, boolean>>;
  quotas: Partial<Record<QuotaKey, number | null>>;
}