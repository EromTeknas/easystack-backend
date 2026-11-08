import { Router } from 'express';
import {
  listSchemas,
  listStagedDeletedSchemas,
  checkSchemaSlug,
  getSchema,
  createSchema,
  updateSchema,
  deleteSchema,
  deploySchema,
  restoreSchema,
} from './schema-blueprint.controller';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import { authorize } from '../../services/authorization/middlewares/authorize.middleware';
import { PERMISSIONS } from '../../services/authorization/constants/permission.constants';

const router = Router({ mergeParams: true });

/**
 * Schemas endpoints: /api/projects/:projectId/schemas
 */

router.get(
  '/',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  listSchemas
);

router.get(
  '/staged-deletions',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  listStagedDeletedSchemas
);

router.get(
  '/check-slug',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  checkSchemaSlug
);

router.get(
  '/:schemaId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  getSchema
);

router.post(
  '/',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.CREATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  createSchema
);

router.post(
  '/:schemaId/deploy',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  deploySchema
);

router.put(
  '/:schemaId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  updateSchema
);

router.delete(
  '/:schemaId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.DELETE,
    scopeId: (req) => req.params.projectId as string,
  }),
  deleteSchema
);

router.post(
  '/:schemaId/restore',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.FEED.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  restoreSchema
);

export default router;
