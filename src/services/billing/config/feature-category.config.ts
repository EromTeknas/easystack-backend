export const FeatureCategories = {
  CORE: "CORE",
  API: "API",
  AI: "AI",
  SECURITY: "SECURITY",
  BILLING: "BILLING",
  INTEGRATION: "INTEGRATION",
} as const;

export type FeatureCategory =
  (typeof FeatureCategories)[keyof typeof FeatureCategories];