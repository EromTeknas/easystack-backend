import { Response } from 'express';
import { BillingService } from '../../services/billing.service';
import { ok } from '../../utils/response';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../errors';

/**
 * PATCH /admin/billing/subscriptions/:userId/override
 * Set custom plan override for a specific user
 */
export const setCustomOverride = asyncHandler(async (req: any, res: Response) => {
  const userIdParam = req.params.userId;
  
  if (!userIdParam) {
    throw new AppError('User ID is required', 400, 'INVALID_USER_ID');
  }
  
  const userId = parseInt(userIdParam as string);
  const { override } = req.body;
  
  if (isNaN(userId)) {
    throw new AppError('Invalid user ID', 400, 'INVALID_USER_ID');
  }
  
  const subscription = await BillingService.setCustomOverride(userId, override);
  
  return ok(res, subscription);
});

/**
 * PATCH /admin/billing/subscriptions/:userId
 * Update a user's subscription
 */
export const updateSubscription = asyncHandler(async (req: any, res: Response) => {
  const userIdParam = req.params.userId;
  
  if (!userIdParam) {
    throw new AppError('User ID is required', 400, 'INVALID_USER_ID');
  }
  
  const userId = parseInt(userIdParam as string);
  const { planId, status, expiresAt } = req.body;
  
  if (isNaN(userId)) {
    throw new AppError('Invalid user ID', 400, 'INVALID_USER_ID');
  }
  
  const updateData: any = {};
  if (planId) updateData.planId = planId;
  if (status) updateData.status = status;
  if (expiresAt) updateData.expiresAt = new Date(expiresAt);
  
  const subscription = await BillingService.updateSubscription(userId, updateData);
  
  return ok(res, subscription);
});

/**
 * GET /admin/billing/subscriptions/:userId
 * Get a user's subscription details with effective plan
 */
export const getUserSubscription = asyncHandler(async (req: any, res: Response) => {
  const userIdParam = req.params.userId;
  
  if (!userIdParam) {
    throw new AppError('User ID is required', 400, 'INVALID_USER_ID');
  }
  
  const userId = parseInt(userIdParam as string);
  
  if (isNaN(userId)) {
    throw new AppError('Invalid user ID', 400, 'INVALID_USER_ID');
  }
  
  const effectivePlan = await BillingService.getEffectivePlan(userId);
  const usage = await BillingService.getUserUsage(userId);
  
  return ok(res, {
    plan: effectivePlan,
    usage,
  });
});
