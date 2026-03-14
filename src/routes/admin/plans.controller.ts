import { Response } from 'express';
import { BillingService } from '../../services/billing.service';
import { ok } from '../../utils/response';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../errors';

/**
 * GET /admin/billing/plans
 * Get all available plans
 */
export const getAllPlans = asyncHandler(async (req: any, res: Response) => {
  const plans = await BillingService.getAllPlans();
  
  return ok(res, plans);
});

/**
 * GET /admin/billing/plans/:id
 * Get a specific plan by ID
 */
export const getPlanById = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  
  if (!id) {
    throw new AppError('Plan ID is required', 400, 'INVALID_PLAN_ID');
  }
  
  const plan = await BillingService.getPlanById(Number(id));
  
  return ok(res, plan);
});

/**
 * POST /admin/billing/plans
 * Create a new plan
 */
export const createPlan = asyncHandler(async (req: any, res: Response) => {
  const { name, displayName, config } = req.body;
  
  const plan = await BillingService.createPlan({
    name,
    displayName,
    config,
  });
  
  return ok(res, plan, { statusCode: 201 });
});

/**
 * PUT /admin/billing/plans/:id
 * Update a plan's configuration (creates version history)
 */
export const updatePlan = asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const { config } = req.body;
  
  if (!id) {
    throw new AppError('Plan ID is required', 400, 'INVALID_PLAN_ID');
  }
  
  const plan = await BillingService.updatePlan(Number(id), config);
  
  return ok(res, plan);
});
