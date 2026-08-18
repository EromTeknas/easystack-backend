import { Router } from 'express';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import * as userController from './user.controller';
import * as userInviteController from './user-invite.controller';

const router = Router();

// Search users
router.get('/search', authenticate, userController.searchUsers);

// Invites
router.get('/invites', authenticate, userInviteController.listUserInvites);
router.post('/invites/:invitationId/respond', authenticate, userInviteController.respondToInvite);

export default router;
