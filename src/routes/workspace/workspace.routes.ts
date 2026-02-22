import { Router } from 'express';
import { authenticate } from '../../middlewares/authentication.middleware';
import { workspaceGuard } from '../../middlewares/workspace-guard.middleware';
import * as workspaceController from './workspace.controller';

const router = Router();

router.get('/', authenticate, workspaceController.listWorkspaces);
router.post('/', authenticate, workspaceController.createWorkspaceController);

router.get('/:workspaceId', authenticate, workspaceGuard(), workspaceController.getWorkspaceById);
router.put(
  '/:workspaceId',
  authenticate,
  workspaceGuard({ roles: ['OWNER', 'ADMIN'] }),
  workspaceController.updateWorkspace
);
router.patch(
  '/:workspaceId',
  authenticate,
  workspaceGuard({ roles: ['OWNER', 'ADMIN'] }),
  workspaceController.patchWorkspace
);

export default router;
