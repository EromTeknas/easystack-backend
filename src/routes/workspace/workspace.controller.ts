import { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "../../errors";
import WorkspaceRepository from "../../repositories/workspace.repository";
import { isValidName } from "../../utils/validation";
import { prisma } from "../../db";
import logger from "../../utils/logger";
import { APP_ROLES } from "../../services/authorization/constants/role.constants";
import { Workspace } from "@prisma/client";
import ResourceIdService from "../../services/resource-id.service";
import { WorkspaceService } from "../../services/workspace/workspace.service";
import { storageService } from "../../services/storage/storage.instance";
import { StoragePrivateAccess } from "../../services/storage/public/storage.contracts";

const normalizeWorkspace = (workspace: Workspace) => {
  if (!workspace) return null;

  const createdAt = workspace.createdAt ;
  const updatedAt = workspace.updatedAt;

  return {
    id: workspace.id,
    resourceId: workspace.resourceId,
    name: workspace.name,
    logoAssetId: workspace.logoAssetId,
    createdBy: workspace.createdById,
    // role: workspace.createdById. ?? null,
    createdAt: createdAt ? new Date(createdAt).toISOString() : null,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
  };
};

async function hydrateWorkspacesWithLogos(workspaces: any[]) {
  return Promise.all(workspaces.map(async (workspace) => {
    if (!workspace || !workspace.logoAssetId) {
      return { ...workspace, logo: null };
    }
    
    try {
      const assets = await storageService.resolveTargetUrls({
        target: {
          nodes: [{ collection: "workspaces", id: workspace.id.toString() }],
          slot: "workspace-logo"
        },
        privateAccess: StoragePrivateAccess.PUBLIC_ONLY
      });
      
      const matchingAsset = assets.find(a => a.id === workspace.logoAssetId);
      
      let logo = null;
      if (matchingAsset) {
        logo = {
          id: matchingAsset.id,
          src: matchingAsset.url,
          mimeType: matchingAsset.mimeType,
          sizeBytes: matchingAsset.sizeBytes
        };
      }

      return {
        ...workspace,
        logo
      };
    } catch (e) {
      logger.error("Failed to hydrate logo for workspace", { workspaceId: workspace.id, error: e });
      return { ...workspace, logo: null };
    }
  }));
}

function buildWorkspaceSlug(name: string, userId: number) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workspace";
  return `${base}-${userId}-${Date.now()}`;
}

/**
 * GET /workspace
 * List all workspaces for the authenticated user
 */
export const listWorkspaces = asyncHandler(async (req: any, res: Response) => {
  logger.debug("GET /api/workspace start");

  const userId = Number(req.user!.id);

  try {
    logger.debug("Fetching workspaces for user", { userId });
    const workspaces = await WorkspaceRepository.getUserWorkspaces(userId);

    if (!Array.isArray(workspaces)) {
      logger.error("Invalid workspaces data received", {
        userId,
        data: workspaces,
      });
      throw new InternalServerError("Failed to retrieve workspaces");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { defaultWorkspaceId: true },
    });

    const normalized = workspaces
      .map(normalizeWorkspace)
      .filter(
        (
          w,
        ): w is typeof normalizeWorkspace extends (...args: any[]) => infer R
          ? R & {}
          : never => w !== null,
      )
      .map(w => ({
        ...w,
        isDefault: w.id === user?.defaultWorkspaceId
      }));

    const hydrated = await hydrateWorkspacesWithLogos(
      normalized as Record<string, any>[]
    );

    logger.debug("Workspaces retrieved successfully", {
      userId,
      count: hydrated.length,
    });
    return ok(res, { workspaces: hydrated });
  } catch (error) {
    logger.error("Error fetching workspaces", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new InternalServerError("Failed to retrieve workspaces");
  }
});

/**
 * POST /workspace
 * Create a new workspace and add creator as OWNER (transactional)
 * If any step fails, all changes are rolled back
 */
export const createWorkspaceController = asyncHandler(
  async (req: any, res: Response) => {
    logger.debug("POST /api/workspace start");
    
    const userId = Number(req.user!.id);
    const { name, logoAssetId } = req.body;

    if (!name || typeof name !== "string" || !isValidName(name)) {
      throw new BadRequestError("Invalid workspace name");
    }

    const result = await WorkspaceService.createWorkspace(userId, name, logoAssetId);

    const normalized = normalizeWorkspace(result);
    const hydratedList = normalized
      ? await hydrateWorkspacesWithLogos([normalized])
      : [null];
    const hydrated = hydratedList[0];

    return ok(res, { workspace: hydrated }, { statusCode: 201 });
  },
);

/**
 * GET /workspace/:workspaceId
 * Get a workspace by ID for authenticated member
 */
export const getWorkspaceById = asyncHandler(
  async (req: any, res: Response) => {
    const userId = Number(req.user!.id);
    const workspaceId = Number(req.params.workspaceId);

    const workspace = await WorkspaceRepository.getUserWorkspaceById(userId, workspaceId);

    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }

    const hydratedList = await hydrateWorkspacesWithLogos([workspace]);
    const hydrated = hydratedList[0];

    return ok(res, { workspace: hydrated });
  },
);

export const updateWorkspace = asyncHandler( async (req: any, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);
  const { name, logoAssetId } = req.body;

  if (name && (typeof name !== "string" || !isValidName(name))) {
    throw new BadRequestError("Invalid workspace name");
  }

  const updatedWorkspace = await WorkspaceService.updateWorkspace(workspaceId, { name, logoAssetId });
  const normalized = normalizeWorkspace(updatedWorkspace as any);
  const hydratedList = normalized ? await hydrateWorkspacesWithLogos([normalized]) : [null];
  const hydrated = hydratedList[0];

  return ok(res, { workspace: hydrated });
});

export const deleteWorkspace = asyncHandler( async (req: any, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);
  
  await WorkspaceService.deleteWorkspace(workspaceId);
  
  return ok(res, { message: "Workspace deleted successfully" });
});

export const listWorkspaceMembers = asyncHandler(async (req: any, res: Response) => {
  const workspaceId = Number(req.params.workspaceId);
  
  const members = await WorkspaceService.listWorkspaceMembers(workspaceId);
  
  return ok(res, { members });
});
