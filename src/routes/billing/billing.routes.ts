import { Router } from 'express';
import { authenticate } from '../../middlewares/authentication.middleware';
import * as billingController from './billing.controller';
import webhookRoutes from './webhook.route';

const router = Router();

// Public webhook route (providers call this)
router.use('/webhook', webhookRoutes);

// Public routes
// router.get('/plans', billingController.getAvailablePlans);

// Protected routes
router.get('/my-plan', authenticate, billingController.getMyPlan);

export default router;
