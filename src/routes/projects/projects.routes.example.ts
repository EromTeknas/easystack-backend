/**
 * Example: Projects Routes with Billing Integration
 * 
 * This is a template showing how to integrate billing guards
 * into your actual feature routes.
 */

import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../../middlewares/authentication.middleware';
import { billingGuard, trackUsage, featureGuard } from '../../middlewares/billing.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { AppError } from '../../errors';

const router = Router();

/**
 * Example 1: Simple quota check + usage tracking
 * 
 * - billingGuard('projects') checks if user can create another project
 * - trackUsage('projects', 1) increments project counter on success
 */
router.post(
  '/',
  authenticate,
  billingGuard('projects'),
  trackUsage('projects', 1),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { name, description } = req.body;

    // Your project creation logic here
    const project = {
      id: '123',
      name,
      description,
      userId,
    };

    // Usage is automatically tracked after success
    return ok(res, project, { statusCode: 201 });
  })
);

/**
 * Example 2: Feature-based access control
 * 
 * Only users with 'team_collaboration' feature can add members
 */
router.post(
  '/:projectId/members',
  authenticate,
  featureGuard('team_collaboration'),
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { userId } = req.body;

    // Add member logic here
    const member = {
      projectId,
      userId,
      role: 'member',
    };

    return ok(res, member);
  })
);

/**
 * Example 3: Dynamic usage tracking
 * 
 * Track AI token usage based on actual consumption
 */
router.post(
  '/ai/generate',
  authenticate,
  billingGuard('ai_tokens_monthly'),
  trackUsage('ai_tokens_monthly', (req) => {
    // Calculate actual tokens used from request
    return req.body.estimatedTokens || 1000;
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt } = req.body;

    // AI generation logic here
    const response = {
      text: 'Generated content...',
      tokensUsed: 1234,
    };

    return ok(res, response);
  })
);

/**
 * Example 4: Manual billing check in controller
 * 
 * When you need more control over the billing logic
 */
router.post(
  '/batch-create',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { projects } = req.body; // Array of projects to create

    // Import BillingService for manual checks
    const { BillingService } = await import('../../services/billing.service');

    // Check if user can create this many projects
    const check = await BillingService.canPerformAction(userId, 'projects');
    
    if (!check.allowed || (check.remaining !== null && check.remaining < projects.length)) {
      throw new AppError(
        `Cannot create ${projects.length} projects. Only ${check.remaining} remaining.`,
        403,
        'QUOTA_EXCEEDED',
        {
          requested: projects.length,
          remaining: check.remaining,
          limit: check.limit,
        }
      );
    }

    // Create projects...
    const createdProjects = projects.map((p: any) => ({
      id: Math.random().toString(),
      ...p,
    }));

    // Manually track usage
    await BillingService.incrementUsage(userId, 'projects', createdProjects.length);

    return ok(res, createdProjects);
  })
);

/**
 * Example 5: Read operations (no billing needed)
 * 
 * List operations typically don't need billing guards
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // List user's projects - no billing check needed
    const projects = [
      { id: '1', name: 'Project 1' },
      { id: '2', name: 'Project 2' },
    ];

    return ok(res, projects);
  })
);

export default router;
