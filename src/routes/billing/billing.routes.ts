import { Router } from 'express';
import { authenticate } from '../../middlewares/authentication.middleware';
import * as billingController from './billing.controller';

const router = Router();

// Public routes
router.get('/plans', billingController.getAvailablePlans);

// Protected routes
router.get('/my-plan', authenticate, billingController.getMyPlan);

export default router;
