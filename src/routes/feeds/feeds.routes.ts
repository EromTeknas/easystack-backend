import { requestReview, respondToReview, createComment, getRootComments, getReplies, updateComment, deleteComment, getCollaborationData } from './collaboration.controller';
import { Router } from 'express';
import { listFeeds, createFeed, validateFeedSchema, checkFeedNameAvailability, getFeedDetail, getLocalizationStatus, getLocalizationContent, retryLocalization, updateDraftBaseContent, updateDraftLocalization, getAuditLogs } from './feeds.controller';
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


router.put(
  '/:feedId/draft',
  authenticate,
  updateDraftBaseContent
);

router.put(
  '/:feedId/localizations/:language',
  authenticate,
  updateDraftLocalization
);

router.get(
  '/:feedId/audit',
  authenticate,
  getAuditLogs
);


// Collaboration Routes (Reviews & Comments)
router.post('/:feedId/localizations/:language/reviews', authenticate, requestReview);
router.put('/:feedId/localizations/:language/reviews/status', authenticate, respondToReview);
router.post('/:feedId/localizations/:language/comments', authenticate, createComment);
router.get('/:feedId/localizations/:language/comments', authenticate, getRootComments);
router.get('/:feedId/localizations/:language/comments/:commentId/replies', authenticate, getReplies);
router.patch('/:feedId/localizations/:language/comments/:commentId', authenticate, updateComment);
router.delete('/:feedId/localizations/:language/comments/:commentId', authenticate, deleteComment);
router.get('/:feedId/localizations/:language/collaboration', authenticate, getCollaborationData);

export default router;

