import { Router } from 'express';
import { apiKeyAuthMiddleware } from '../middlewares/api-key-auth.middleware';
import testRoutes from './test.routes';
import contentRoutes from './content.routes';

const router = Router();

// All delivery API routes require API key authentication
router.use(apiKeyAuthMiddleware);

router.use('/test', testRoutes);
router.use('/content', contentRoutes);

export default router;
