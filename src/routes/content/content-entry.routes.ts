import { Router } from 'express';
import {
  listContentEntries,
  checkContentEntrySlug,
  getContentEntry,
  createContentEntry,
  updateContentEntry,
  deleteContentEntry,
  publishContentEntry,
  discardContentEntryDraft,
  scheduleContentEntry,
  syncEnvironmentData,
  getContentAuditLogs,
  triggerContentEntryTranslations,
} from './content-entry.controller';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import { authorize } from '../../services/authorization/middlewares/authorize.middleware';
import { PERMISSIONS } from '../../services/authorization/constants/permission.constants';

const router = Router({ mergeParams: true });

/**
 * Developer content sync: POST /api/projects/:projectId/content/sync-environments
 */
router.post(
  '/sync-environments',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  syncEnvironmentData
);


/**
 * Content endpoints: /api/projects/:projectId/content/:schemaSlug
 */

router.get(
  '/:schemaSlug',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  listContentEntries
);

router.get(
  '/:schemaSlug/check-slug',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  checkContentEntrySlug
);

router.get(
  '/:schemaSlug/:entryId/audit-logs',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  getContentAuditLogs
);

router.get(
  '/:schemaSlug/:entryId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  getContentEntry
);

router.post(
  '/:schemaSlug',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.CREATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  createContentEntry
);

router.put(
  '/:schemaSlug/:entryId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  updateContentEntry
);

router.delete(
  '/:schemaSlug/:entryId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.DELETE,
    scopeId: (req) => req.params.projectId as string,
  }),
  deleteContentEntry
);

router.post(
  '/:schemaSlug/:entryId/publish',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  publishContentEntry
);

router.post(
  '/:schemaSlug/:entryId/discard-draft',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  discardContentEntryDraft
);

router.post(
  '/:schemaSlug/:entryId/schedule',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  scheduleContentEntry
);

router.post(
  '/:schemaSlug/:entryId/translate',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  triggerContentEntryTranslations
);

export default router;

