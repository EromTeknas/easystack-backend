import { requestReview, addReviewers, approveReview,
  closeReview, createComment, getRootComments, getReplies, updateComment, deleteComment, } from './collaboration.controller';
import { Router } from 'express';
import { listFeeds, createFeed, validateFeedSchema, checkFeedNameAvailability, getFeedDetail, getLocalizationStatus, getLocalizationContent, retryLocalization, updateDraftBaseContent, updateDraftLocalization,
  markLocalizationCompleted, getAuditLogs } from './feeds.controller';
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
  authorize({ scope: 'project', permission: PERMISSIONS.FEED.READ, scopeId: req => req.params.projectId as string }),
  listFeeds
);

router.post(
  '/',
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.FEED.CREATE, scopeId: req => req.params.projectId as string }),
  createFeed
);

router.get(
  '/:feedId',
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.FEED.READ, scopeId: req => req.params.projectId as string }),
  getFeedDetail
);

router.get(
  '/:feedId/localizations/status',
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.FEED.READ, scopeId: req => req.params.projectId as string }),
  getLocalizationStatus
);

router.get(
  '/:feedId/localizations/:language/content',
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.READ, scopeId: req => req.params.projectId as string }),
  getLocalizationContent
);

router.post(
  '/:feedId/localizations/:language/retry',
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.UPDATE, scopeId: req => req.params.projectId as string }),
  retryLocalization
);

router.post(
  '/validate',
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.FEED.READ, scopeId: req => req.params.projectId as string }),
  validateFeedSchema
);


router.put(
  '/:feedId/draft',
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.FEED.UPDATE, scopeId: req => req.params.projectId as string }),
  updateDraftBaseContent
);

router.put(
  '/:feedId/localizations/:language',
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.UPDATE, scopeId: req => req.params.projectId as string }),
  updateDraftLocalization
);

router.put(
  '/:feedId/localizations/:language/mark-completed',
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.UPDATE, scopeId: req => req.params.projectId as string }),
  markLocalizationCompleted
);

router.get(
  '/:feedId/audit',
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.FEED.READ, scopeId: req => req.params.projectId as string }),
  getAuditLogs
);


// Collaboration Routes (Reviews & Comments)
router.post(
  '/:feedId/localizations/:language/reviews', 
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.UPDATE, scopeId: req => req.params.projectId as string }),
  requestReview
);

router.post(
  '/:feedId/localizations/:language/comments/:commentId/reviewers', 
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.UPDATE, scopeId: req => req.params.projectId as string }),
  addReviewers
);

router.put(
  '/:feedId/localizations/:language/comments/:commentId/approve', 
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.UPDATE, scopeId: req => req.params.projectId as string }),
  approveReview
);

router.put(
  '/:feedId/localizations/:language/comments/:commentId/close', 
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.UPDATE, scopeId: req => req.params.projectId as string }),
  closeReview
);

router.post(
  '/:feedId/localizations/:language/comments', 
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.READ, scopeId: req => req.params.projectId as string }),
  createComment
);

router.get(
  '/:feedId/localizations/:language/comments', 
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.READ, scopeId: req => req.params.projectId as string }),
  getRootComments
);

router.get(
  '/:feedId/localizations/:language/comments/:commentId/replies', 
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.READ, scopeId: req => req.params.projectId as string }),
  getReplies
);

router.patch(
  '/:feedId/localizations/:language/comments/:commentId', 
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.READ, scopeId: req => req.params.projectId as string }),
  updateComment
);

router.delete(
  '/:feedId/localizations/:language/comments/:commentId', 
  authenticate,
  authorize({ scope: 'project', permission: PERMISSIONS.LOCALIZATION.READ, scopeId: req => req.params.projectId as string }),
  deleteComment
);


export default router;

