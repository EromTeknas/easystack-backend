import { Router } from 'express';
import { listFeeds, createFeed, validateFeedSchema, checkFeedNameAvailability, getFeedDetail, getLocalizationStatus, getLocalizationContent, retryLocalization } from './feeds.controller';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import { authorize } from '../../services/authorization/middlewares/authorize.middleware';
import { PERMISSIONS } from '../../services/authorization/constants/permission.constants';

const router = Router({ mergeParams: true });

/**
 * Feeds are nested under projects: /api/projects/:projectId/feeds
 */

router.get(
  '/check-name',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.READ,
    scopeId: req => req.params.projectId as string,
  }),
  checkFeedNameAvailability
);

router.get(
  '/',
  authenticate,
  listFeeds
);

router.post(
  '/',
  authenticate,
  createFeed
);

router.get(
  '/:feedId',
  authenticate,
  getFeedDetail
);

router.get(
  '/:feedId/localizations/status',
  authenticate,
  getLocalizationStatus
);

router.get(
  '/:feedId/localizations/:language/content',
  authenticate,
  getLocalizationContent
);

router.post(
  '/:feedId/localizations/:language/retry',
  authenticate,
  retryLocalization
);

router.post(
  '/validate',
  authenticate,
  validateFeedSchema
);

export default router;
