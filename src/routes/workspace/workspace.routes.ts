import { Router } from 'express';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import * as workspaceController from './workspace.controller';
import { authorize } from '../../services/authorization/middlewares/authorize.middleware';
import { PERMISSIONS } from '../../services/authorization/constants/permission.constants';

import * as workspaceInviteController from './workspace-invite.controller';

const router = Router();

// Create workspace
router.post('/', authenticate, workspaceController.createWorkspaceController);

// List user workspaces - userId as query parameter
router.get('/', authenticate, workspaceController.listWorkspaces);

// --- Invitations & Roles ---
router.get('/roles', authenticate, workspaceInviteController.getWorkspaceRoles);

// Get specific workspace
router.get('/:workspaceId', authenticate, workspaceController.getWorkspaceById);

// Update workspace
router.patch('/:workspaceId', authenticate, authorize({scope: 'workspace', permission: PERMISSIONS.WORKSPACE.UPDATE, scopeId: req => req.params.workspaceId as string}), workspaceController.updateWorkspace);

// Delete workspace
router.delete('/:workspaceId', authenticate, authorize({scope: 'workspace', permission: PERMISSIONS.WORKSPACE.DELETE, scopeId: req => req.params.workspaceId as string}), workspaceController.deleteWorkspace);

// List workspace members
router.get('/:workspaceId/members', authenticate, authorize({scope: 'workspace', permission: PERMISSIONS.WORKSPACE.READ, scopeId: req => req.params.workspaceId as string}), workspaceController.listWorkspaceMembers);

// --- Invitations & Roles ---
router.get('/roles', authenticate, authorize({scope: 'workspace', permission: PERMISSIONS.WORKSPACE.READ, scopeId: req => req.params.workspaceId as string}), workspaceInviteController.getWorkspaceRoles);
router.get('/:workspaceId/invitation-context', authenticate, authorize({scope: 'workspace', permission: PERMISSIONS.WORKSPACE.INVITE, scopeId: req => req.params.workspaceId as string}), workspaceInviteController.getInvitationContext);
router.post('/:workspaceId/invites', authenticate, authorize({scope: 'workspace', permission: PERMISSIONS.WORKSPACE.INVITE, scopeId: req => req.params.workspaceId as string}), workspaceInviteController.sendInvite);
router.get('/:workspaceId/invites', authenticate, authorize({scope: 'workspace', permission: PERMISSIONS.WORKSPACE.READ, scopeId: req => req.params.workspaceId as string}), workspaceInviteController.listWorkspaceInvites);
router.delete('/:workspaceId/invites/:invitationId', authenticate, authorize({scope: 'workspace', permission: PERMISSIONS.WORKSPACE.INVITE, scopeId: req => req.params.workspaceId as string}), workspaceInviteController.revokeInvite);

export default router;
