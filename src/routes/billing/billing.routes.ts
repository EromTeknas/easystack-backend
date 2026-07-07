import { Router } from 'express';
import { authenticate } from '../../middlewares/authentication.middleware';
import * as billingController from './billing.controller';
import webhookRoutes from './webhook.route';
import { billingMiddleware } from '../../services/billing/middleware/express/billing.middleware';

const router = Router();

// Public webhook route (providers call this)
router.use('/webhook', webhookRoutes);

// Public routes
// router.get('/plans', billingController.getAvailablePlans);

// Protected routes
router.get('/workspaces/:workspaceId/my-plan', authenticate, billingController.getMyPlan);



// Test Endpoint: Simulate adding a project/content
router.post(
  "/test/add-content",
  authenticate,
  billingMiddleware(
    (req) => Number(req.body?.workspaceId ?? req.query.workspaceId ?? req.workspace?.id),
    {
      subscription: true, // Requires an active plan
      quotas: [
        {
          key: "api.requests.daily", // Validates against the Quotas.API_REQUESTS definition
          amount: 1,
          consume: true, // Tells UsageService to increment this by 1
        },
      ],
    }
  ),
  (req, res) => {
    // If the middleware passes, the quota was successfully consumed in Redis/MySQL
    res.json({ message: "Content added successfully! Quota consumed." });
  }
);
export default router;
