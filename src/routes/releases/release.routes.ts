import { Router, Request } from 'express';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import { authorize } from '../../services/authorization/middlewares/authorize.middleware';
import { PERMISSIONS } from '../../services/authorization/constants/permission.constants';
import { ReleaseController } from './release.controller';

const router = Router({ mergeParams: true });

router.use(authenticate);

const authorizeRelease = (permission: string) => authorize({
  scope: 'project',
  permission,
  scopeId: (req: Request) => req.params.projectId as string
});

router.get('/diff', authorizeRelease(PERMISSIONS.RELEASE.READ), ReleaseController.getEnvironmentDiff);
router.get('/suggest-version', authorizeRelease(PERMISSIONS.RELEASE.READ), ReleaseController.suggestVersion);
router.post('/', authorizeRelease(PERMISSIONS.RELEASE.CREATE), ReleaseController.createRelease);
router.get('/', authorizeRelease(PERMISSIONS.RELEASE.READ), ReleaseController.listReleases);
router.get('/:releaseId', authorizeRelease(PERMISSIONS.RELEASE.READ), ReleaseController.getRelease);
router.post('/:releaseId/request-approval', authorizeRelease(PERMISSIONS.RELEASE.CREATE), ReleaseController.requestApproval);
router.post('/:releaseId/approve', authorizeRelease(PERMISSIONS.RELEASE.APPROVE), ReleaseController.approveRelease);
router.post('/:releaseId/execute', authorizeRelease(PERMISSIONS.RELEASE.EXECUTE), ReleaseController.executeRelease);
router.post('/:releaseId/schedule', authorizeRelease(PERMISSIONS.RELEASE.EXECUTE), ReleaseController.scheduleRelease);
router.post('/:releaseId/cancel-schedule', authorizeRelease(PERMISSIONS.RELEASE.EXECUTE), ReleaseController.cancelSchedule);
router.post('/:releaseId/rollback', authorizeRelease(PERMISSIONS.RELEASE.ROLLBACK), ReleaseController.rollbackRelease);
router.delete('/:releaseId', authorizeRelease(PERMISSIONS.RELEASE.DELETE), ReleaseController.deleteRelease);

export default router;
