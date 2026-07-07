import { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "../../errors";
import WorkspaceRepository from "../../repositories/workspace.repository";
import { ImageUrlService } from "../../services/image-url.service";
import { isValidName } from "../../utils/validation";
import { prisma } from "../../db";
import logger from "../../utils/logger";
import { RoleRegistry } from "../../services/authorization/configs/roles-registry.config";
import { RoleRepository } from "../../repositories/role.repository";
import { APP_ROLES } from "../../services/authorization/constants/role.constants";
import { Workspace } from "@prisma/client";

const normalizeWorkspace = (workspace: Workspace) => {
  if (!workspace) return null;

  const createdAt = workspace.createdAt ;
  const updatedAt = workspace.updatedAt;

  return {
    id: workspace.id,
    name: workspace.name,
    logoUrl: workspace.logoUrl,
    createdBy: workspace.createdById,
    // role: workspace.createdById. ?? null,
    createdAt: createdAt ? new Date(createdAt).toISOString() : null,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
  };
};

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

    const normalized = workspaces
      .map(normalizeWorkspace)
      .filter(
        (
          w,
        ): w is typeof normalizeWorkspace extends (...args: any[]) => infer R
          ? R & {}
          : never => w !== null,
      );

    const hydrated = await ImageUrlService.hydrateArray(
      normalized as Record<string, any>[],
      ["logoUrl"],
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
    const { name, logoUrl } = req.body;

    if (!name || typeof name !== "string" || !isValidName(name)) {
      throw new BadRequestError("Invalid workspace name");
    }

    // if (logoUrl !== undefined && logoUrl !== null && typeof logoUrl !== 'string') {
    //   throw new BadRequestError('Invalid logoUrl');
    // }

    // Transactional: Create workspace + add member
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: name.trim(),
          slug: buildWorkspaceSlug(name.trim(), userId),
          logoUrl: logoUrl || null,
          createdById: userId,
        },
      });

      logger.info("Workspace created in transaction", {
        workspaceId: workspace.id,
        name: workspace.name,
        createdBy: userId,
      });

      const ownerRole = await RoleRepository.findByKey(
        APP_ROLES.WORKSPACE.WORKSPACE_OWNER,
      );

      if (!ownerRole) {
        throw new InternalServerError(
          "Workspace owner role not found. Ensure roles are seeded.",
        );
      }

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: workspace.createdById,
          roleId: ownerRole.id,
        },
      });

      logger.info("Workspace created", {
        workspaceId: workspace.id,
        userId: workspace.createdById,
      });

      return workspace;
    });

    const normalized = normalizeWorkspace(result);
    const hydrated = normalized
      ? await ImageUrlService.hydrateObject(normalized, ["logoUrl"])
      : null;

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

    const hydrated = await ImageUrlService.hydrateObject(workspace, ["logoUrl"])

    return ok(res, { workspace: hydrated });
  },
);

export const updateWorkspace = asyncHandler( async (req: any, res: Response) => {
  return ok(res, { message: "Update workspace endpoint is under construction" });
});
