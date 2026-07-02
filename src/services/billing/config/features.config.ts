import { FeatureCategories } from "./feature-category.config";

export const Features = {
  API_ACCESS: {
    key: "api.access",
    displayName: "API Access",
    description: "Allows calling the REST API.",
    category: FeatureCategories.API,
  },

  AI_ASSISTANT: {
    key: "ai.assistant",
    displayName: "AI Assistant",
    description: "Access to AI features.",
    category: FeatureCategories.AI,
  },
} as const;

export type FeatureKey =
  (typeof Features)[keyof typeof Features]["key"];