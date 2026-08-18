import { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { BadRequestError } from "../../errors";
import { UserInviteService } from "../../services/user/user-invite.service";

/**
 * GET /api/user/invites
 * List all pending received invitations for the logged-in user
 */
export const listUserInvites = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const userEmail = req.user!.email;

  const invitations = await UserInviteService.listReceivedInvites(userId, userEmail);
  return ok(res, { invitations });
});

/**
 * POST /api/user/invites/:invitationId/respond
 * Accept or decline an invitation
 */
export const respondToInvite = asyncHandler(async (req: any, res: Response) => {
  const userId = Number(req.user!.id);
  const userEmail = req.user!.email;
  const invitationId = Number(req.params.invitationId);
  const { action } = req.body; // 'ACCEPT' | 'DECLINE'

  if (action !== "ACCEPT" && action !== "DECLINE") {
    throw new BadRequestError("Invalid action. Must be ACCEPT or DECLINE.");
  }

  const result = await UserInviteService.respondToInvite(userId, userEmail, invitationId, action);
  return ok(res, result);
});
