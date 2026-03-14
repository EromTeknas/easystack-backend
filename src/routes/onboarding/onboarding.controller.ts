import { Request, Response } from 'express';
import { BillingService } from '../../services/billing.service';
import { ok } from '../../utils/response';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../db';

/**
 * GET /onboarding/status
 * Get the onboarding status of the authenticated user
 * Protected endpoint (requires authentication)
 * 
 * Response:
 *   - onboardingCompleted (boolean)
 */
export const getOnboardingStatus = asyncHandler(async (req: any, res: Response) => {
    const userId = Number(req.user!.id);
    const user = await prisma.user.findUnique({
        where: { id: userId }
    });
    const onboardingCompleted = user?.onboardingCompleted || false;
    
    return ok(res, {
        onboardingCompleted,
    });

});

/**
 * POST /onboarding/completed
 * Mark the onboarding process as completed for the authenticated user
 * Protected endpoint (requires authentication)
 * 
 * Response:
 *   - message: "Onboarding marked as completed"
 */
export const markOnboardingCompleted = asyncHandler(async (req: any, res: Response) => {
    const userId = Number(req.user!.id);
    await prisma.user.update({
        where: { id: userId },
        data: { onboardingCompleted: true }
    });
    
    return ok(res, {
        message: 'Onboarding marked as completed'
    });
});