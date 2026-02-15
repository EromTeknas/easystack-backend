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
  logger.info('GET /api/health start', {
    ipAddress: _req.ip,
    req: _req.body
  });
  try {
    return ok(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } finally {
    logger.info('GET /api/health end', {
      ipAddress: _req.ip
    });
  }
}));

export default router;
