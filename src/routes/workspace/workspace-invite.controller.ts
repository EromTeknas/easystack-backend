import { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { WorkspaceInviteService } from "../../services/workspace/workspace-invite.service";

/**
 * GET /api/workspace/roles
 * Get all available workspace roles (excludes OWNER)
 */
export const getWorkspaceRoles = asyncHandler(async (req: any, res: Response) => {
  const roles = await WorkspaceInviteService.getWorkspaceRoles();
  return ok(res, { roles });
});

/**
 * GET /api/workspace/:workspaceId/invitation-context
 * List projects and project-level roles for the invitation UI
 */
export const getInvitationContext = asyncHandler(async (req: any, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);
  const context = await WorkspaceInviteService.getInvitationContext(workspaceId);
  return ok(res, context);
});

/**
 * POST /api/workspace/:workspaceId/invites
 * Send a new workspace invitation
 */
export const sendInvite = asyncHandler(async (req: any, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);
  const inviterId = Number(req.user!.id);
  const inviterName = req.user!.firstName || req.user!.email;
  
  const invitation = await WorkspaceInviteService.sendInvite(
    workspaceId,
    inviterId,
    inviterName,
    req.body
  );

  return ok(res, { message: "Invitation sent successfully", invitationId: invitation.id }, { statusCode: 201 });
});

/**
 * GET /api/workspace/:workspaceId/invites
 * List all sent invites for a workspace
 */
export const listWorkspaceInvites = asyncHandler(async (req: any, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);
  const invitations = await WorkspaceInviteService.listSentInvites(workspaceId);
  return ok(res, { invitations });
});

/**
 * DELETE /api/workspace/:workspaceId/invites/:invitationId
 * Delete (revoke) an active invitation
 */
export const revokeInvite = asyncHandler(async (req: any, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);
  const invitationId = Number(req.params.invitationId);
  const inviterId = Number(req.user!.id);
  
  const result = await WorkspaceInviteService.revokeInvite(workspaceId, invitationId, inviterId);
  return ok(res, result);
});
