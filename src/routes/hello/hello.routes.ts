import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

/**
 * GET /api/
 * Hello World endpoint
 * Returns a greeting message
 */
router.get('/', asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Hello, World!',
      timestamp: new Date().toISOString(),
    },
  });
}));

export default router;
