import WorkspaceInvitationRepository from "../../repositories/workspace-invitation.repository";
import { prisma } from "../../db";
import { BadRequestError, NotFoundError } from "../../errors";

export class UserInviteService {
  static async listReceivedInvites(userId: number, userEmail: string) {
    return WorkspaceInvitationRepository.getReceivedInvitations(userId, userEmail);
  }

  static async respondToInvite(userId: number, userEmail: string, invitationId: number, action: "ACCEPT" | "DECLINE") {
    const invitation = await WorkspaceInvitationRepository.findById(invitationId);

    if (!invitation) {
      throw new NotFoundError("Invitation not found");
    }

    if (invitation.inviteeId !== userId && invitation.inviteeEmail !== userEmail) {
      throw new BadRequestError("You do not have permission to respond to this invitation");
    }

    if (invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
      throw new BadRequestError("Invitation is no longer valid");
    }

    if (action === "DECLINE") {
      await WorkspaceInvitationRepository.updateStatus(invitationId, "DECLINED", userId);
      return { message: "Invitation declined", workspaceId: invitation.workspaceId };
    }

    // ACCEPT FLOW
    await prisma.$transaction(async (tx) => {
      // Mark accepted
      await tx.workspaceInvitation.update({
        where: { id: invitationId },
        data: { status: "ACCEPTED", inviteeId: userId }
      });

      // Add to WorkspaceMember
      const existingMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: invitation.workspaceId, userId }
        }
      });

      let workspaceMemberId: number;
      if (existingMember) {
        await tx.workspaceMember.update({
          where: { id: existingMember.id },
          data: { roleId: invitation.workspaceRoleId, removedAt: null }
        });
        workspaceMemberId = existingMember.id;
      } else {
        const newMember = await tx.workspaceMember.create({
          data: {
            workspaceId: invitation.workspaceId,
            userId: userId,
            roleId: invitation.workspaceRoleId
          }
        });
        workspaceMemberId = newMember.id;
      }

      // Add project assignments
      for (const assignment of invitation.projectAssignments) {
        const existingProjectMember = await tx.projectMember.findUnique({
          where: {
            projectId_workspaceMemberId: {
              projectId: assignment.projectId,
              workspaceMemberId
            }
          }
        });

        if (existingProjectMember) {
          await tx.projectMember.update({
            where: { id: existingProjectMember.id },
            data: { roleId: assignment.roleId, removedAt: null }
          });
        } else {
          await tx.projectMember.create({
            data: {
              projectId: assignment.projectId,
              workspaceMemberId,
              roleId: assignment.roleId
            }
          });
        }
      }
    });

    return { message: "Invitation accepted successfully", workspaceId: invitation.workspaceId };
  }
}
