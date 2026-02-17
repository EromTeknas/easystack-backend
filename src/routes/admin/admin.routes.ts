import { Router } from 'express';
import { adminDashboardAuth } from '../../middlewares/admin-auth.middleware';
import * as plansController from './plans.controller';
import * as subscriptionsController from './subscriptions.controller';

const router = Router();

// Internal admin dashboard routes (auth logic to be added later)
router.use(adminDashboardAuth);

// Plans management
router.get('/plans', plansController.getAllPlans);
router.get('/plans/:id', plansController.getPlanById);
router.post('/plans', plansController.createPlan);
router.put('/plans/:id', plansController.updatePlan);

// Subscriptions management
router.get('/subscriptions/:userId', subscriptionsController.getUserSubscription);
router.patch('/subscriptions/:userId', subscriptionsController.updateSubscription);
router.patch('/subscriptions/:userId/override', subscriptionsController.setCustomOverride);

export default router;
