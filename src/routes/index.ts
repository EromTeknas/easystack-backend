import { Router } from 'express';
import healthRoutes from './health/health.routes';
import helloRoutes from './hello/hello.routes';
import authRoutes from './auth/auth.routes';
import billingRoutes from './billing/billing.routes';
import adminRoutes from './admin/admin.routes';

const router = Router();

// Authentication routes
router.use('/auth', authRoutes);

// Billing routes
router.use('/billing', billingRoutes);

// Admin routes
router.use('/admin/billing', adminRoutes);

// Health routes
router.use('/health', healthRoutes);

// Hello routes
router.use('/hello', helloRoutes);

export default router;
