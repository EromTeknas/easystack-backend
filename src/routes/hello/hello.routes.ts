import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';

const router = Router();

/**
 * GET /api/
 * Hello World endpoint
 * Returns a greeting message
 */
router.get('/', asyncHandler(async (_req, res) => {
  return ok(res, {
    message: 'Hello, World!',
    timestamp: new Date().toISOString(),
  });
}));

export default router;
