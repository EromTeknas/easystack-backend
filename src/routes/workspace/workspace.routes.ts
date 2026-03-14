import { Router } from 'express';
import { authenticate } from '../../middlewares/authentication.middleware';
import { workspaceGuard } from '../../middlewares/workspace-guard.middleware';
import * as workspaceController from './workspace.controller';

const router = Router();

// Create workspace
router.post('/', authenticate, workspaceController.createWorkspaceController);

// List user workspaces - userId as query parameter
router.get('/user', authenticate, workspaceController.listWorkspaces);

// Get specific workspace
router.get('/:workspaceId', authenticate, workspaceController.getWorkspaceById);

router.put(
    '/:workspaceId',
    authenticate,
    // workspaceGuard({ roles: ['OWNER', 'ADMIN'] }),
    workspaceController.updateWorkspace
);
router.patch(
    '/:workspaceId',
    authenticate,
    // workspaceGuard({ roles: ['OWNER', 'ADMIN'] }),
    workspaceController.patchWorkspace
);

export default router;
