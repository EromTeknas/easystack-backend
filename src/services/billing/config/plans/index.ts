import { FreePlan } from "./free.plan";
import { ProPlan } from "./pro.plan";
import { EnterprisePlan } from "./enterprise.plan";

export const PlanRegistry = [
  FreePlan,
  ProPlan,
  EnterprisePlan,
] as const;