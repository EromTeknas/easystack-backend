/**
 * Workspace Service
 * Manages workspace creation, membership, and operations
 */

import { prisma } from '../db/prisma';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { workspace as workspaceConfig } from '../config/workspace';
import { is } from 'zod/v4/locales';

interface WorkspaceInput {
  name: string;
  logoUrl?: string;
  createdBy: number;
}

interface WorkspaceMember {
  id: number;
  workspaceId: number;
  userId: number;
  role: 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'PUBLISHER';
  createdAt: Date;
}

/**
 * Create a new workspace
 */
export async function createWorkspace(input: WorkspaceInput): Promise<number> {
  try {
    const workspace = await prisma.workspace.create({
      data: {
        name: input.name,
        logoUrl: input.logoUrl || null,
        createdBy: input.createdBy,
      } as any, // Type assertion since id is auto-generated
    });

    logger.info('Workspace created', {
      workspaceId: workspace.id,
      name: input.name,
      createdBy: input.createdBy,
    });

    return workspace.id;
  } catch (error) {
    logger.error('Failed to create workspace:', error);
    throw error;
  }
}

/**
 * Create default workspace for new user
 */
export async function createDefaultWorkspace(userId: number): Promise<number> {
  return createWorkspace({
    name: workspaceConfig.defaults.name,
    createdBy: userId,
  });
}

/**
 * Add user to workspace with role
 */
export async function addWorkspaceMember(
  workspaceId: number,
  userId: number,
  role: 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'PUBLISHER' = 'DEVELOPER',
  isDefault = false
): Promise<number> {
  try {
    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role,
        isDefault,
      } as any, // Type assertion since id is auto-generated
    });

    logger.info('User added to workspace', {
      workspaceId,
      userId,
      role,
      isDefault,
    });

    return member.id as unknown as number;
  } catch (error) {
    logger.error('Failed to add workspace member:', error);
    throw error;
  }
}

/**
 * Get user's workspaces
 */
export async function getUserWorkspaces(userId: number): Promise<any[]> {
  try {
    const workspaces = await prisma.workspaceMember.findMany({
      where: {
        userId,
      },
      include: {
        workspace: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return workspaces.map((member) => ({
      id: member.workspace.id,
      name: member.workspace.name,
      logo_url: member.workspace.logoUrl,
      role: member.role,
      is_default: member.isDefault,
      created_at: member.workspace.createdAt,
      updated_at: member.workspace.updatedAt,
    }));
  } catch (error) {
    logger.error('Failed to fetch user workspaces:', error);
    throw error;
  }
}

/**
 * Get user's role in a workspace
 */
export async function getUserWorkspaceRole(
  workspaceId: number,
  userId: number
): Promise<'OWNER' | 'ADMIN' | 'DEVELOPER' | 'PUBLISHER' | null> {
  try {
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
      },
      select: {
        role: true,
      },
    });

    return member?.role as 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'PUBLISHER' | null;
  } catch (error) {
    logger.error('Failed to fetch user role:', error);
    return null;
  }
}

/**
 * Get workspace by ID with member info
 */
export async function getWorkspaceWithRole(
  workspaceId: number,
  userId: number
): Promise<any> {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      include: {
        members: {
          where: {
            userId,
          },
          select: {
            role: true,
          },
        },
      },
    });

    if (!workspace) {
      return null;
    }

    return {
      id: workspace.id,
      name: workspace.name,
      logo_url: workspace.logoUrl,
      created_by: workspace.createdBy.toString(),
      role: workspace.members[0]?.role || null,
      created_at: workspace.createdAt,
      updated_at: workspace.updatedAt,
    };
  } catch (error) {
    logger.error('Failed to fetch workspace:', error);
    return null;
  }
}

/**
 * Check if user is workspace owner
 */
export async function isWorkspaceOwner(
  workspaceId: number,
  userId: number
): Promise<boolean> {
  const role = await getUserWorkspaceRole(workspaceId, userId);
  return role === 'OWNER';
}

/**
 * Check if user has admin role in workspace
 */
export async function isWorkspaceAdmin(
  workspaceId: number,
  userId: number
): Promise<boolean> {
  const role = await getUserWorkspaceRole(workspaceId, userId);
  return role === 'OWNER' || role === 'ADMIN';
}
