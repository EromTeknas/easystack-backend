import { Router } from 'express';
import healthRoutes from './health/health.routes';
import helloRoutes from './hello/hello.routes';

const router = Router();

// Health routes
router.use('/health', healthRoutes);

// Hello routes
router.use('/hello', helloRoutes);

export default router;
