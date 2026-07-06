import { Router } from 'express';
import healthRoutes from './health/health.routes';
import helloRoutes from './hello/hello.routes';
import authRoutes from './auth/auth.routes';
import billingRoutes from './billing/billing.routes';
import storageRoutes from './storage/storage.routes';
import onboardingRoutes from './onboarding/onboarding.routes';
import workspaceRoutes from './workspace/workspace.routes';
import projectsRoutes from './projects/projects.routes';
import publicBillingRoutes from './public/billing/billing.routes';
const router = Router();

// Authentication routes
router.use('/auth', authRoutes);

// Billing routes
router.use('/billing', billingRoutes);

// Storage routes
router.use('/storage', storageRoutes);

// Onboarding routes
router.use('/onboarding', onboardingRoutes);

// Workspace routes
router.use('/workspace', workspaceRoutes);

// Projects routes
router.use('/projects', projectsRoutes);

// Health routes
router.use('/health', healthRoutes);

// Hello routes
router.use('/hello', helloRoutes);

// Public Billing routes
router.use('/public/billing', publicBillingRoutes);

export default router;
