import { Router } from 'express';
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
} from './api-keys.controller';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import { authorize } from '../../services/authorization/middlewares/authorize.middleware';
import { PERMISSIONS } from '../../services/authorization/constants/permission.constants';

const router = Router({ mergeParams: true });

/**
 * API Key Management Endpoints: /api/projects/:projectId/api-keys
 */

router.get(
  '/',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.API_KEY.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  listApiKeys
);

router.post(
  '/',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.API_KEY.CREATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  createApiKey
);

router.delete(
  '/:apiKeyId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.API_KEY.REVOKE,
    scopeId: (req) => req.params.projectId as string,
  }),
  revokeApiKey
);

export default router;
