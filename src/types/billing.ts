/**
 * Billing types and interfaces
 */

export interface PlanLimits {
  projects?: number | null;
  environments?: number | null;
  users?: number | null;
  api_requests_per_minute?: number | null;
  storage_mb?: number | null;
  ai_tokens_monthly?: number | null;
  [key: string]: number | null | undefined;
}

export interface PlanFeatures {
  custom_domain?: boolean;
  team_collaboration?: boolean;
  audit_logs?: boolean;
  [key: string]: boolean | undefined;
}

export interface PlanPricing {
  monthly: number;
  yearly: number;
  currency: string;
}

export interface PlanConfig {
  limits: PlanLimits;
  features: PlanFeatures;
  pricing: PlanPricing;
}

export interface EffectivePlan {
  id: string;
  name: string;
  displayName: string;
  config: PlanConfig;
}

export interface UsageData {
  projects?: number;
  environments?: number;
  users?: number;
  api_requests?: number;
  ai_tokens?: number;
  storage_mb?: number;
  [key: string]: number | undefined;
}
