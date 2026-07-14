import { Router } from 'express';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import * as workspaceController from './workspace.controller';
import { authorize } from '../../services/authorization/middlewares/authorize.middleware';
import { PERMISSIONS } from '../../services/authorization/constants/permission.constants';

const router = Router();

// Create workspace
router.post('/', authenticate, workspaceController.createWorkspaceController);

// List user workspaces - userId as query parameter
router.get('/', authenticate, workspaceController.listWorkspaces);

// Get specific workspace
router.get('/:workspaceId', authenticate, workspaceController.getWorkspaceById);

// Update workspace
router.patch('/:workspaceId', authenticate, authorize({scope: 'workspace', permission: PERMISSIONS.WORKSPACE.UPDATE, scopeId: req => req.params.workspaceId as string}), workspaceController.updateWorkspace);
export default router;
