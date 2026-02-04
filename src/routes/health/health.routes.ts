import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import logger from '../../logger';
import { ok } from '../../utils/response';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint
 * Returns the health status of the application
 */
router.get('/', asyncHandler(async (_req, res) => {
  // Log verification
  logger.info('Health check requested', {
    ipAddress: _req.ip,
    req: _req.body
  });
  return ok(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}));

export default router;
