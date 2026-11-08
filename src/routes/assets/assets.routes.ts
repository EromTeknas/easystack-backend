import { Router } from 'express';
import {
  getStorageUsage,
  createUploadIntent,
  completeUpload,
  listAssets,
  getAsset,
  updateAsset,
  deleteAsset,
} from './assets.controller';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import { authorize } from '../../services/authorization/middlewares/authorize.middleware';
import { PERMISSIONS } from '../../services/authorization/constants/permission.constants';

const router = Router({ mergeParams: true });

// GET /api/projects/:projectId/assets/storage-usage
router.get(
  '/storage-usage',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  getStorageUsage
);

// POST /api/projects/:projectId/assets/upload-intent
router.post(
  '/upload-intent',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  createUploadIntent
);

// POST /api/projects/:projectId/assets/complete-upload
router.post(
  '/complete-upload',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  completeUpload
);

// GET /api/projects/:projectId/assets
router.get(
  '/',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  listAssets
);

// GET /api/projects/:projectId/assets/:assetId
router.get(
  '/:assetId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.READ,
    scopeId: (req) => req.params.projectId as string,
  }),
  getAsset
);

// PATCH /api/projects/:projectId/assets/:assetId
router.patch(
  '/:assetId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  updateAsset
);

// DELETE /api/projects/:projectId/assets/:assetId
router.delete(
  '/:assetId',
  authenticate,
  authorize({
    scope: 'project',
    permission: PERMISSIONS.PROJECT.UPDATE,
    scopeId: (req) => req.params.projectId as string,
  }),
  deleteAsset
);

export default router;
