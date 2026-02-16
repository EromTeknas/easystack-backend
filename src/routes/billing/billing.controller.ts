import { Request, Response } from 'express';
import { BillingService } from '../../services/billing.service';
import { ok } from '../../utils/response';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * GET /billing/my-plan
 * Get current user's effective plan and usage
 */
export const getMyPlan = asyncHandler(async (req: any, res: Response) => {
  const userId = req.user!.id;
  
  const effectivePlan = await BillingService.getEffectivePlan(userId);
  const usage = await BillingService.getUserUsage(userId);
  
  return ok(res, {
    plan: effectivePlan,
    usage,
  });
});

/**
 * GET /billing/plans
 * Get all available plans (public)
 */
export const getAvailablePlans = asyncHandler(async (req: any, res: Response) => {
  const plans = await BillingService.getAllPlans();
  
  return ok(res, plans);
});
