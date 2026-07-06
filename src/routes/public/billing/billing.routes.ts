import { Router } from 'express';
import { getPublicPlans, getPlanFeatures } from './billing.controller';

const router = Router();

router.get('/plans', getPublicPlans);

router.get('/features', getPlanFeatures);

export default router;
