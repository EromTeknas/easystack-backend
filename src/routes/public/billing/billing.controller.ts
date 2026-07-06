import { BillingCycle } from "@prisma/client";
import { prisma } from "../../../db";
import { FeatureService, PlanService } from "../../../services/billing";
import asyncHandler from "../../../utils/asyncHandler";
import { ok } from "../../../utils/response";
import { Response } from "express";

const planService = new PlanService(prisma);
/**
 * GET /public/plans
 * Get all public plans (PUBLIC - no auth required)
 */
export const getPublicPlans = asyncHandler(async (req: any, res: Response) => {
    
    // 1. Fetch public plan base records
    const publicPlans = await planService.getPublicPlans();

    // 2. Fetch the latest version details for each plan
    const formattedPlans = await Promise.all(
      publicPlans.map(async (basePlan) => {
        const latest = await planService.getLatest(basePlan.key);
        
        if (!latest) return null;

        // Separate pricing into a clean Monthly/Yearly map
        const pricing = {
          monthly: latest.pricing.find((p) => p.billingCycle === BillingCycle.MONTHLY),
          yearly: latest.pricing.find((p) => p.billingCycle === BillingCycle.YEARLY),
        };

        return {
          id: latest.id,
          key: basePlan.key,
          name: latest.plan.displayName,
          description: latest.plan.description,
          isPopular: basePlan.key === "pro", // Hardcoded highlight logic, adjust as needed
          trial: latest.trial?.enabled 
            ? { days: latest.trial.durationDays } 
            : null,
          pricing: {
            currency: pricing.monthly?.currency ?? "INR",
            monthly: pricing.monthly ? Number(pricing.monthly.amount) : 0,
            yearly: pricing.yearly ? Number(pricing.yearly.amount) : 0,
            yearlyCompareAt: pricing.yearly?.compareAtAmount ? Number(pricing.yearly.compareAtAmount) : null,
          },
          features: latest.features
            .filter((f) => f.enabled)
            .map((f) => f.feature.displayName),
          limits: latest.quotas.map((q) => ({
            name: q.quota.displayName,
            value: q.value === null ? "Unlimited" : q.value,
            unit: q.quota.unit,
          })),
        };
      })
    );

    return ok(res, {
      plans: formattedPlans.filter(Boolean),
    });
});

/**
 * GET /api/public/billing/features
 * Publicly lists all features to help build a comparison table.
 */

export const getPlanFeatures = asyncHandler(async (req, res) => {
    // You already have this method in your FeatureService!
    const features = await FeatureService.list(); 
    
    return ok(res, { features });
  })
