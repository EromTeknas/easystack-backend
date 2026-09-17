import WorkspaceRepository from "../../repositories/workspace.repository";
import { prisma } from "../../db";
import ResourceIdService from "../../services/resource-id.service";
import { APP_ROLES } from "../../services/authorization/constants/role.constants";
import { InternalServerError } from "../../errors";

function buildWorkspaceSlug(name: string, userId: number) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workspace";
  return `${base}-${userId}-${Date.now()}`;
}

export class WorkspaceService {
  static async createWorkspace(userId: number, name: string, logoAssetId?: string) {
    return prisma.$transaction(async (tx) => {
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

      return workspace;
    });
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
        }
      }
    });

    if (!workspace) return;

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
}
