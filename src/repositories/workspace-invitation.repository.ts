import { prisma } from "../db";
import { WorkspaceInvitation, InvitationStatus } from "@prisma/client";

class WorkspaceInvitationRepository {
  async createInvitation(data: any): Promise<WorkspaceInvitation> {
    return prisma.workspaceInvitation.create({ data });
  }

  async findById(id: number) {
    return prisma.workspaceInvitation.findUnique({
      where: { id },
      include: { projectAssignments: true }
    });
  }

  async findPendingByWorkspaceAndUser(workspaceId: number, userId: number, email: string) {
    return prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        OR: [
          { inviteeId: userId !== -1 ? userId : null },
          { inviteeEmail: email }
        ],
        status: "PENDING",
        expiresAt: { gt: new Date() }
      }
    });
  }

  async getSentInvitationsByWorkspaceId(workspaceId: number) {
    return prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      include: {
        inviter: { select: { id: true, firstName: true, lastName: true, email: true } },
        invitee: { select: { id: true, firstName: true, lastName: true, email: true } },
        role: { select: { id: true, name: true } },
        projectAssignments: {
          include: {
            project: { select: { id: true, name: true } },
            role: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async getReceivedInvitations(userId: number, userEmail: string) {
    return prisma.workspaceInvitation.findMany({
      where: {
        OR: [
          { inviteeId: userId },
          { inviteeEmail: userEmail }
        ],
        status: "PENDING",
        expiresAt: { gt: new Date() }
      },
      include: {
        workspace: { select: { id: true, name: true, logoAssetId: true } },
        inviter: { select: { id: true, firstName: true, lastName: true, email: true } },
        role: { select: { id: true, name: true, key: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async updateStatus(id: number, status: InvitationStatus, inviteeId: number) {
    return prisma.workspaceInvitation.update({
      where: { id },
      data: { status, inviteeId }
    });
  }
}

export default new WorkspaceInvitationRepository();
