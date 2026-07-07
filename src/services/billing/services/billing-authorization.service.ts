import { prisma } from "../../../db";
import { ForbiddenError } from "../../../errors";

const BILLING_MUTATION_ROLES = new Set(["WORKSPACE_OWNER", "WORKSPACE_ADMIN"]);

export class BillingAuthorizationService {
  static async ensureWorkspaceMember(userId: number, workspaceId: number) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        role: true,
      },
    });

    if (!membership || membership.removedAt) {
      throw new ForbiddenError("You do not have access to this workspace.", "WORKSPACE_ACCESS_DENIED", {
        workspaceId,
      });
    }

    return membership;
  }

  static async ensureBillingMutationAllowed(userId: number, workspaceId: number) {
    const membership = await this.ensureWorkspaceMember(userId, workspaceId);

    if (!BILLING_MUTATION_ROLES.has(membership.role.key)) {
      throw new ForbiddenError("You do not have permission to change billing for this workspace.", "BILLING_PERMISSION_DENIED", {
        workspaceId,
      });
    }

    return membership;
  }
}
