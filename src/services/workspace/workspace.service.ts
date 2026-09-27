import WorkspaceRepository from "../../repositories/workspace.repository";
import { prisma } from "../../db";
import ResourceIdService from "../../services/resource-id.service";
import { APP_ROLES } from "../../services/authorization/constants/role.constants";
import { InternalServerError } from "../../errors";

function buildWorkspaceSlug(name: string, userId: number) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workspace";
  return `${base}-${userId}-${Date.now()}`;
}

import { SubscriptionService } from "../billing/services/subscription.service";
import { UsageService } from "../billing/services/usage.service";
import { BillingService } from "../billing/services/billing.service";
import { BadRequestError, NotFoundError } from "../../errors";

export class WorkspaceService {
  static async createWorkspace(userId: number, name: string, logoAssetId?: string, planKey: string = 'free') {
    // 1. Anti-Spam Guards
    if (planKey === 'free') {
      const freeCount = await prisma.workspace.count({
        where: {
          createdById: userId,
          subscription: {
            planVersion: {
              plan: { key: 'free' }
            },
            status: 'ACTIVE'
          }
        }
      });
      if (freeCount >= 1) {
        throw new BadRequestError("You already own a Free workspace. Additional workspaces must be created on a Pro plan.");
      }
    } else if (planKey === 'pro') {
      const trialCount = await prisma.workspace.count({
        where: {
          createdById: userId,
          subscription: {
            planVersion: {
              plan: { key: 'pro' }
            },
            status: 'TRIAL'
          }
        }
      });
      if (trialCount >= 1) {
        throw new BadRequestError("You can only have 1 active Pro trial. Please enter a payment method to create additional Pro workspaces.");
      }
    }

    // 2. Transactional Creation
    const result = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          resourceId: await ResourceIdService.generateUniqueWorkspaceId(tx),
          name: name.trim(),
          slug: buildWorkspaceSlug(name.trim(), userId),
          logoAssetId: logoAssetId || null,
          createdById: userId,
        },
      });

      const ownerRole = await tx.role.findUnique({
        where: { key: APP_ROLES.WORKSPACE.WORKSPACE_OWNER },
      });

      if (!ownerRole) {
        throw new InternalServerError("Workspace owner role not found. Ensure roles are seeded.");
      }

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: workspace.createdById,
          roleId: ownerRole.id,
        },
      });

      // 3. Billing Provisioning (Directly in tx to avoid cache race conditions)
      const plan = await tx.plan.findUnique({
        where: { key: planKey },
        include: {
          versions: {
            where: { isLatest: true },
            orderBy: { version: "desc" },
            take: 1,
            include: { trial: true, quotas: { include: { quota: true } } },
          },
        },
      });

      const planVersion = plan?.versions[0];
      if (!plan || !planVersion) {
        throw new InternalServerError(`Plan '${planKey}' not found.`);
      }

      const now = new Date();
      const hasTrial = plan.key === "pro" && planVersion.trial?.enabled === true;
      const status = hasTrial ? 'TRIAL' : 'ACTIVE';
      const trialEndsAt = hasTrial
        ? new Date(now.getTime() + (planVersion.trial?.durationDays ?? 0) * 24 * 60 * 60 * 1000)
        : null;

      const subscription = await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          billingOwnerId: userId,
          planVersionId: planVersion.id,
          status,
          startsAt: now,
          trialEndsAt,
        },
        select: { id: true },
      });

      await tx.subscriptionHistory.create({
        data: {
          workspaceId: workspace.id,
          subscriptionId: subscription.id,
          planVersionId: planVersion.id,
          status,
          startsAt: now,
          reason: "WORKSPACE_CREATION",
        },
      });

      if (planVersion.quotas.length > 0) {
        await tx.usage.createMany({
          data: planVersion.quotas.map((quota) => ({
            workspaceId: workspace.id,
            quotaId: quota.quotaId,
            value: quota.quota.key === 'members' ? 1 : 0,
          })),
          skipDuplicates: true,
        });
      }

      return workspace;
    });

    // 4. Force cache refresh and usage sync after tx commits
    await UsageService.initialize(result.id);
    return result;
  }

  static async updateWorkspace(workspaceId: number, data: { name?: string; logoAssetId?: string }) {
    return WorkspaceRepository.updateWorkspace(workspaceId, data);
  }

  static async deleteWorkspace(workspaceId: number) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        projects: {
          include: { feeds: { select: { id: true } } }
        },
        subscription: true
      }
    });

    if (!workspace) return;

    // FIXME(Billing): When Stripe/Paddle is integrated, we MUST cancel the external
    // subscription here via API before we delete the workspace and cascade-destroy the DB row.
    if (workspace.subscription?.gatewaySubscriptionId) {
      // await PaymentGatewayService.cancelSubscription(workspace.subscription.gatewaySubscriptionId);
    }

    const projectIds = workspace.projects.map(p => p.id);
    const feedIds = workspace.projects.flatMap(p => p.feeds.map(f => f.id));

    await WorkspaceRepository.deleteWorkspace(workspaceId);

    const { enqueueCleanupJob } = require('../cleanup/infrastructure/queue/cleanup.queue');
    await enqueueCleanupJob({
      type: 'workspace',
      workspaceId,
      projectIds,
      feedIds,
      workspaceResourceId: workspace.resourceId
    });
  }

  static async listWorkspaceMembers(workspaceId: number) {
    return WorkspaceRepository.getWorkspaceMembers(workspaceId);
  }

  static async updateWorkspaceMemberRole(workspaceId: number, targetUserId: number, newRoleId: number) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } }
    });

    if (!member || member.removedAt) {
      throw new NotFoundError("Member not found in this workspace");
    }
    
    const newRole = await prisma.role.findUnique({ where: { id: newRoleId } });
    if (!newRole) {
      throw new BadRequestError("Invalid role");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedMember = await tx.workspaceMember.update({
        where: { id: member.id },
        data: { roleId: newRoleId }
      });
      
      // If promoting to Admin or Owner, soft-delete all redundant explicit project memberships
      // This prevents "hidden state" and security risks where a demoted admin retains old roles
      if (newRole.key === 'WORKSPACE_OWNER' || newRole.key === 'WORKSPACE_ADMIN') {
        await tx.projectMember.updateMany({
          where: { workspaceMemberId: member.id, removedAt: null },
          data: { removedAt: new Date() }
        });
      }

      return updatedMember;
    });

    // Invalidate auth cache so their new role takes effect immediately
    const { AuthorizationCacheService } = require('../authorization/cache/cache.service');
    await AuthorizationCacheService.evict(targetUserId.toString());

    return updated;
  }

  static async removeWorkspaceMember(workspaceId: number, targetUserId: number, actorUserId: number) {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      include: { role: true }
    });

    if (!member || member.removedAt) {
      throw new NotFoundError("Member not found in this workspace");
    }

    if (member.role.key === 'WORKSPACE_OWNER') {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId, removedAt: null, role: { key: 'WORKSPACE_OWNER' } }
      });
      if (ownerCount <= 1) {
        throw new BadRequestError("Cannot remove the last workspace owner. Transfer ownership or delete the workspace.");
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Soft delete the workspace member
      await tx.workspaceMember.update({
        where: { id: member.id },
        data: { removedAt: new Date() }
      });

      // 2. Soft delete all project member records for this workspace member
      await tx.projectMember.updateMany({
        where: { workspaceMemberId: member.id, removedAt: null },
        data: { removedAt: new Date() }
      });
    });

    // 3. Release billing quota
    const { UsageService } = require('../billing');
    await UsageService.release(workspaceId, 'members', 1);

    // 4. Invalidate auth cache
    const { AuthorizationCacheService } = require('../authorization/cache/cache.service');
    await AuthorizationCacheService.evict(targetUserId.toString());

    return { success: true };
  }
}
