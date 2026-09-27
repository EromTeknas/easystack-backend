import { Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { ok } from "../../../utils/response";
import { NotFoundError, BadRequestError } from "../../../errors";
import WorkspaceInvitationRepository from "../../../repositories/workspace-invitation.repository";

export const getInvitationByToken = asyncHandler(async (req: any, res: Response) => {
  const token = req.params.token as string;
  if (!token) throw new BadRequestError("Token is required");

  const invitation = await WorkspaceInvitationRepository.findByToken(token);
  
  if (!invitation || invitation.status !== 'PENDING') {
    throw new NotFoundError("Invitation not found, already accepted, or revoked");
  }

  if (invitation.expiresAt < new Date()) {
    throw new BadRequestError("This invitation has expired");
  }

  // Return safe info for the public landing page
  return ok(res, {
    workspaceName: invitation.workspace.name,
    inviterName: invitation.inviter.firstName ? `${invitation.inviter.firstName} ${invitation.inviter.lastName}` : invitation.inviter.email,
    roleName: invitation.role.name,
    roleDescription: invitation.role.description,
    inviteeEmail: invitation.inviteeEmail,
    projectAssignments: invitation.projectAssignments.map(pa => pa.project.name)
  });
});
