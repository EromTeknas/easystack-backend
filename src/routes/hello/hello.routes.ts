import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import logger from '../../utils/logger';
import { ok } from '../../utils/response';

const router = Router();

/**
 * GET /api/
 * Hello World endpoint
 * Returns a greeting message
 */
router.get('/', asyncHandler(async (_req, res) => {
  logger.info('GET /api/hello start');
  try {
    return ok(res, {
      message: 'Hello, World!',
      timestamp: new Date().toISOString(),
    });
  } finally {
    logger.info('GET /api/hello end');
  }
}));

export default router;
