import { Router } from 'express';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import * as onboardingController from './onboarding.controller';

const router = Router();

router.get('/status', authenticate, onboardingController.getOnboardingStatus);

router.post('/completed', authenticate, onboardingController.markOnboardingCompleted);

export default router;
