import { Request, Response } from 'express';
import { BillingService } from '../../services/billing.service';
import { BillingAuthorizationService } from '../../services/billing/services/billing-authorization.service';
import { BadRequestError } from '../../errors';
import { ok } from '../../utils/response';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * GET /billing/workspaces/:workspaceId/my-plan
 * Get current workspace's effective plan and usage
 */
export const getMyPlan = asyncHandler(async (req: any, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);

  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    throw new BadRequestError('workspaceId must be a positive number');
  }

  await BillingAuthorizationService.ensureWorkspaceMember(Number(req.user!.id), workspaceId);
  
  const effectivePlan = await BillingService.getEffectivePlan(workspaceId);
  const usage = await BillingService.getWorkspaceUsage(workspaceId);
  
  return ok(res, {
    plan: effectivePlan,
    usage,
  });
});
