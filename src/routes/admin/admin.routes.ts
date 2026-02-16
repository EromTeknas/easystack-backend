import { Router } from 'express';
import { authenticate } from '../../middlewares/authentication.middleware';
import { adminOnly } from '../../middlewares/billing.middleware';
import * as plansController from './plans.controller';
import * as subscriptionsController from './subscriptions.controller';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(adminOnly);

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
