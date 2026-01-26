import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint
 * Returns the health status of the application
 */
router.get('/', asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
}));

export default router;
