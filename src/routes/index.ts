import { Router } from 'express';
import healthRoutes from './health/health.routes';
import helloRoutes from './hello/hello.routes';
import authRoutes from './auth/auth.routes';

const router = Router();

// Authentication routes
router.use('/auth', authRoutes);

// Health routes
router.use('/health', healthRoutes);

// Hello routes
router.use('/hello', helloRoutes);

export default router;
