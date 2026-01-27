/**
 * Workspace Service
 * Manages workspace creation, membership, and operations
 */

import { db } from '../db';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { workspace as workspaceConfig } from '../config/workspace';

interface WorkspaceInput {
  name: string;
  logoUrl?: string;
  createdBy: string;
}

interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'USER';
  createdAt: Date;
}

/**
 * Create a new workspace
 */
export async function createWorkspace(input: WorkspaceInput): Promise<string> {
  const workspaceId = uuidv4();

  try {
    await db.query(
      'INSERT INTO workspaces (id, name, logo_url, created_by) VALUES (?, ?, ?, ?)',
      [workspaceId, input.name, input.logoUrl || null, input.createdBy]
    );

    logger.info('Workspace created', {
      workspaceId,
      name: input.name,
      createdBy: input.createdBy
    });

    return workspaceId;
  } catch (error) {
    logger.error('Failed to create workspace:', error);
    throw error;
  }
}

/**
 * Create default workspace for new user
 */
export async function createDefaultWorkspace(userId: string): Promise<string> {
  return createWorkspace({
    name: workspaceConfig.defaults.name,
    createdBy: userId
  });
}

/**
 * Add user to workspace with role
 */
export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'USER' = 'USER'
): Promise<string> {
  const memberId = uuidv4();

  try {
    await db.query(
      'INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)',
      [memberId, workspaceId, userId, role]
    );

    logger.info('User added to workspace', {
      workspaceId,
      userId,
      role
    });

    return memberId;
  } catch (error) {
    logger.error('Failed to add workspace member:', error);
    throw error;
  }
}

/**
 * Get user's workspaces
 */
export async function getUserWorkspaces(userId: string): Promise<any[]> {
  try {
    const [workspaces] = await db.query(
      `SELECT w.id, w.name, w.logo_url, wm.role, w.created_at, w.updated_at
       FROM workspaces w
       JOIN workspace_members wm ON w.id = wm.workspace_id
       WHERE wm.user_id = ?
       ORDER BY wm.created_at DESC`,
      [userId]
    ) as any;

    return workspaces || [];
  } catch (error) {
    logger.error('Failed to fetch user workspaces:', error);
    throw error;
  }
}

/**
 * Get user's role in a workspace
 */
export async function getUserWorkspaceRole(
  workspaceId: string,
  userId: string
): Promise<'OWNER' | 'ADMIN' | 'USER' | null> {
  try {
    const [[result]] = await db.query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, userId]
    ) as any;

    return result?.role || null;
  } catch (error) {
    logger.error('Failed to fetch user role:', error);
    return null;
  }
}

/**
 * Get workspace by ID with member info
 */
export async function getWorkspaceWithRole(
  workspaceId: string,
  userId: string
): Promise<any> {
  try {
    const [[workspace]] = await db.query(
      `SELECT w.id, w.name, w.logo_url, w.created_by, wm.role, w.created_at, w.updated_at
       FROM workspaces w
       LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ?
       WHERE w.id = ?`,
      [userId, workspaceId]
    ) as any;

    return workspace || null;
  } catch (error) {
    logger.error('Failed to fetch workspace:', error);
    return null;
  }
}

/**
 * Check if user is workspace owner
 */
export async function isWorkspaceOwner(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const role = await getUserWorkspaceRole(workspaceId, userId);
  return role === 'OWNER';
}

/**
 * Check if user has admin role in workspace
 */
export async function isWorkspaceAdmin(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const role = await getUserWorkspaceRole(workspaceId, userId);
  return role === 'OWNER' || role === 'ADMIN';
}
