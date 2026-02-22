import { Router } from 'express';
import { authenticate } from '../../middlewares/authentication.middleware';
import * as onboardingController from './onboarding.controller';

const router = Router();

router.get('/status', authenticate, onboardingController.getOnboardingStatus);

router.post('/completed', authenticate, onboardingController.markOnboardingCompleted);

export default router;
