import RoleRepository from "../../repositories/role.repository";
import { ProjectRepository } from "../../repositories/project.repository";
import WorkspaceInvitationRepository from "../../repositories/workspace-invitation.repository";
import UserRepository from "../../repositories/user.repository";
import { prisma } from "../../db";
import { BadRequestError } from "../../errors";
import crypto from "crypto";
import { sendWorkspaceInviteEmail } from "../email.service";

export class WorkspaceInviteService {
  static async getWorkspaceRoles() {
    return RoleRepository.getRolesByScope("WORKSPACE", "WORKSPACE_OWNER");
  }

  static async getInvitationContext(workspaceId: number) {
    const projects = await ProjectRepository.listWorkspaceProjects(prisma, workspaceId);
    const projectRoles = await RoleRepository.getRolesByScope("PROJECT");

    return {
      projects: projects.map(p => ({ id: p.id, name: p.name })),
      projectRoles: projectRoles.map(r => ({ id: r.id, key: r.key, name: r.name, description: r.description }))
    };
  }

  static async sendInvite(
    workspaceId: number, 
    inviterId: number, 
    inviterName: string, 
    data: { userId?: number; email?: string; workspaceRoleId: number; projectAssignments?: any[] }
  ) {
    if (!data.email && !data.userId) {
      throw new BadRequestError("Must provide userId or email");
    }

    const role = await RoleRepository.findWorkspaceRole(data.workspaceRoleId, "WORKSPACE_OWNER");
    if (!role) {
      throw new BadRequestError("Invalid workspace role");
    }

    let invitee = null;
    if (data.userId) {
      invitee = await UserRepository.findById(data.userId);
    } else if (data.email) {
      invitee = await UserRepository.findByEmail(data.email);
    }

    const inviteeEmail = invitee ? invitee.email : data.email;
    if (!inviteeEmail) {
      throw new BadRequestError("Email is required for the invitation");
    }

    const pendingInvite = await WorkspaceInvitationRepository.findPendingByWorkspaceAndUser(workspaceId, invitee?.id || -1, inviteeEmail);
    if (pendingInvite) {
      throw new BadRequestError("An active invitation already exists for this email");
    }

    if (invitee) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: invitee.id }
        }
      });
      if (existingMember && !existingMember.removedAt) {
        throw new BadRequestError("User is already a member of this workspace");
      }
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await WorkspaceInvitationRepository.createInvitation({
      workspaceId,
      inviterId,
      inviteeId: invitee?.id,
      inviteeEmail,
      workspaceRoleId: data.workspaceRoleId,
      token,
      expiresAt,
      projectAssignments: {
        create: data.projectAssignments?.map((pa: any) => ({
          projectId: pa.projectId,
          roleId: pa.roleId
        })) || []
      }
    });

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    await sendWorkspaceInviteEmail(
      inviteeEmail,
      inviterName,
      workspace?.name || "Workspace",
      token
    );

    return invitation;
  }

  static async listSentInvites(workspaceId: number) {
    return WorkspaceInvitationRepository.getSentInvitationsByWorkspaceId(workspaceId);
  }

  static async revokeInvite(workspaceId: number, invitationId: number, inviterId: number) {
    const invite = await WorkspaceInvitationRepository.findById(invitationId);
    if (!invite || invite.workspaceId !== workspaceId) {
      throw new BadRequestError("Invitation not found");
    }
    
    // Revoke by simply deleting it (or could set status to REVOKED)
    await prisma.workspaceInvitation.delete({
      where: { id: invitationId }
    });
    
    return { message: "Invitation revoked successfully" };
  }
}
