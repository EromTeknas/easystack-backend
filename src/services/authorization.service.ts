/**
 * Authorization Service
 * Central permission resolution engine for workspace and project operations
 * Implements layered permission resolution with role-based defaults and custom overrides
 */

import { prisma } from '../db/prisma';
import {
  PermissionAction,
  PermissionResolution,
  PermissionCheckOptions,
  WorkspaceRole,
} from '../types/authorization';
import {
  ProjectRoleEnum,
  ProjectPermissionAction,
  ROLE_PERMISSION_MAP,
  getPermissionsForRoles,
} from '../constants/projectRoles';
import { ForbiddenError, BadRequestError } from '../errors';
import logger from '../utils/logger';

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  USER: 1,
};

export class AuthorizationService {
  /**
   * Main permission resolution algorithm
   * Layered approach: membership → OWNER bypass → custom override → role default → project membership
   *
   * @param userId The user checking permission
   * @param workspaceId The workspace context
   * @param action The action being checked (e.g., 'workspace.update.name')
   * @param projectId Optional; required if action is project-scoped
   * @returns PermissionResolution with allowed flag and reason
   */
  async getEffectivePermission(
    userId: number,
    workspaceId: number,
    action: PermissionAction,
    projectId?: number
  ): Promise<PermissionResolution> {
    try {
      // Step 1: Check workspace membership
      const workspaceMember = await prisma.workspaceMember.findUnique({
        where: {
          uk_workspace_user: {
            workspaceId,
            userId,
          },
        },
      });

      if (!workspaceMember) {
        return {
          allowed: false,
          reason: 'denied',
          resolvedAt: Date.now(),
        };
      }

      // Step 2-3: OWNER bypass - implicit full access
      if (workspaceMember.role === 'OWNER') {
        return {
          allowed: true,
          reason: 'owner_bypass',
          resolvedAt: Date.now(),
        };
      }

      // Step 4: Check custom permission override for this member
      const customPermission = await prisma.workspaceMemberPermission.findUnique({
        where: {
          uk_member_action: {
            workspaceMemberId: workspaceMember.id,
            action,
          },
        },
      });

      if (customPermission) {
        return {
          allowed: customPermission.isAllowed,
          reason: 'custom_override',
          resolvedAt: Date.now(),
        };
      }

      // Step 5: Check role default permissions
      const rolePermission = await prisma.rolePermission.findUnique({
        where: {
          uk_role_action: {
            role: workspaceMember.role,
            action,
          },
        },
      });

      if (rolePermission) {
        return {
          allowed: true,
          reason: 'role_default',
          resolvedAt: Date.now(),
        };
      }

      // Step 6: If project-scoped action, check project membership
      const isProjectScoped = action.startsWith('project.');
      if (isProjectScoped && projectId) {
        const projectMember = await prisma.projectMember.findUnique({
          where: {
            uk_project_user: {
              projectId,
              userId,
            },
          },
        });

        if (projectMember?.isActive) {
          return {
            allowed: true,
            reason: 'project_membership',
            resolvedAt: Date.now(),
          };
        }
      }

      // Step 7: Deny
      return {
        allowed: false,
        reason: 'denied',
        resolvedAt: Date.now(),
      };
    } catch (error) {
      logger.error('Authorization resolution failed', {
        userId: userId.toString(),
        workspaceId: workspaceId.toString(),
        action,
        error,
      });
      throw error;
    }
  }

  /**
   * Convenience method: check permission and throw if denied
   * Use in route handlers before executing action
   */
  async requirePermission(
    userId: number,
    workspaceId: number,
    action: PermissionAction,
    projectId?: number
  ): Promise<void> {
    const result = await this.getEffectivePermission(userId, workspaceId, action, projectId);

    if (!result.allowed) {
      logger.warn('Permission denied', {
        userId: userId.toString(),
        workspaceId: workspaceId.toString(),
        action,
        reason: result.reason,
      });
      throw new ForbiddenError(`Permission denied: ${action}`);
    }
  }

  /**
   * Get all project IDs visible to user in workspace
   * Updated for new system: all users (including OWNER/ADMIN) must be project members with roles
   *
   * - OWNER: sees all projects (auto-added to all)
   * - ADMIN: sees all projects (auto-added to all)
   * - USER: sees only explicitly assigned projects
   */
  async getVisibleProjectIds(userId: number, workspaceId: number): Promise<number[]> {
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        uk_workspace_user: {
          workspaceId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!workspaceMember) {
      return [];
    }

    // OWNER and ADMIN see all projects in workspace
    if (workspaceMember.role === 'OWNER' || workspaceMember.role === 'ADMIN') {
      const projects = await prisma.project.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      return projects.map((p) => p.id as number);
    }

    // USER sees only projects they're explicitly assigned to
    const assignments = await prisma.projectMember.findMany({
      where: {
        workspaceId,
        userId,
        isActive: true,
      },
      select: { projectId: true },
    });

    return assignments.map((a) => a.projectId as number);
  }

  /**
   * Grant a custom permission to a workspace member
   * Can allow or deny specific actions beyond role defaults
   *
   * @param grantedByUserId User making the grant (must have permission to grant)
   * @param workspaceMemberId Target workspace member
   * @param action The action to grant/deny
   * @param isAllowed true=grant, false=deny
   * @param reason Optional reason for audit trail
   */
  async grantPermission(
    grantedByUserId: number,
    workspaceMemberId: number,
    action: PermissionAction,
    isAllowed: boolean,
    reason?: string
  ): Promise<void> {
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: { id: workspaceMemberId },
      select: { workspaceId: true, userId: true },
    });

    if (!workspaceMember) {
      throw new BadRequestError('Workspace member not found');
    }

    // Caller must have permission to grant permissions
    await this.requirePermission(
      grantedByUserId,
      workspaceMember.workspaceId,
      'workspace.members.assign_role'
    );

    // Caller cannot grant permissions higher than their own role
    const [callerMember, targetMember] = await Promise.all([
      prisma.workspaceMember.findUnique({
        where: {
          uk_workspace_user: {
            workspaceId: workspaceMember.workspaceId,
            userId: grantedByUserId,
          },
        },
      }),
      prisma.workspaceMember.findUnique({
        where: { id: workspaceMemberId },
      }),
    ]);

    if (!callerMember) {
      throw new ForbiddenError('Caller is not a workspace member');
    }

    if (!targetMember) {
      throw new ForbiddenError('Target member not found');
    }

    if ((ROLE_HIERARCHY[targetMember.role as WorkspaceRole] ?? 0) > (ROLE_HIERARCHY[callerMember.role as WorkspaceRole] ?? 0)) {
      throw new ForbiddenError('Cannot grant permissions to users with higher role than yours');
    }

    // Upsert custom permission
    await prisma.workspaceMemberPermission.upsert({
      where: {
        uk_member_action: {
          workspaceMemberId,
          action,
        },
      },
      create: {
        workspaceMemberId,
        action,
        isAllowed,
        grantedByUserId,
        reason: reason || null,
      },
      update: {
        isAllowed,
        grantedByUserId,
        reason: reason || null,
        grantedAt: new Date(),
      },
    });

    logger.info('Permission granted', {
      grantedBy: grantedByUserId.toString(),
      member: workspaceMember.userId.toString(),
      workspace: workspaceMember.workspaceId.toString(),
      action,
      allowed: isAllowed,
    });
  }

  /**
   * Revoke a custom permission grant
   */
  async revokePermission(
    revokedByUserId: number,
    workspaceMemberId: number,
    action: PermissionAction
  ): Promise<void> {
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: { id: workspaceMemberId },
      select: { workspaceId: true },
    });

    if (!workspaceMember) {
      throw new BadRequestError('Workspace member not found');
    }

    // Caller must have permission
    await this.requirePermission(
      revokedByUserId,
      workspaceMember.workspaceId,
      'workspace.members.assign_role'
    );

    await prisma.workspaceMemberPermission.delete({
      where: {
        uk_member_action: {
          workspaceMemberId,
          action,
        },
      },
    });

    logger.info('Permission revoked', {
      revokedBy: revokedByUserId.toString(),
      member: workspaceMemberId.toString(),
      action,
    });
  }

  /**
   * Validate role assignment (prevent privilege escalation)
   * Caller cannot assign role higher than their own
   */
  validateRoleAssignment(
    callerRole: WorkspaceRole,
    targetRole: WorkspaceRole,
    targetCurrentRole?: WorkspaceRole
  ): void {
    // Cannot assign role higher than caller's own
    if ((ROLE_HIERARCHY[targetRole] ?? 0) > (ROLE_HIERARCHY[callerRole] ?? 0)) {
      throw new ForbiddenError('Cannot assign role higher than your own');
    }

    // OWNER cannot be changed/downgraded by anyone except themselves
    if (targetCurrentRole === 'OWNER' && callerRole !== 'OWNER') {
      throw new ForbiddenError('Cannot modify OWNER role');
    }
  }

  /**
   * Get all effective permissions for a user in a workspace
   * Useful for frontend to determine UI capabilities
   */
  async getEffectivePermissions(
    userId: number,
    workspaceId: number
  ): Promise<Set<PermissionAction>> {
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        uk_workspace_user: {
          workspaceId,
          userId,
        },
      },
    });

    if (!workspaceMember) {
      return new Set();
    }

    const permissions = new Set<PermissionAction>();

    // If OWNER, add all role permissions
    if (workspaceMember.role === 'OWNER') {
      const ownerPerms = await prisma.rolePermission.findMany({
        where: { role: 'OWNER' },
        select: { action: true },
      });
      ownerPerms.forEach((p) => permissions.add(p.action as PermissionAction));
      return permissions;
    }

    // Get role default permissions
    const rolePerms = await prisma.rolePermission.findMany({
      where: { role: workspaceMember.role },
      select: { action: true },
    });
    rolePerms.forEach((p) => permissions.add(p.action as PermissionAction));

    // Get custom overrides (only allowed ones)
    const customPerms = await prisma.workspaceMemberPermission.findMany({
      where: {
        workspaceMemberId: workspaceMember.id,
        isAllowed: true,
      },
      select: { action: true },
    });
    customPerms.forEach((p) => permissions.add(p.action as PermissionAction));

    // Remove denied permissions
    const deniedPerms = await prisma.workspaceMemberPermission.findMany({
      where: {
        workspaceMemberId: workspaceMember.id,
        isAllowed: false,
      },
      select: { action: true },
    });
    deniedPerms.forEach((p) => permissions.delete(p.action as PermissionAction));

    return permissions;
  }

  /**
   * PROJECT AUTHORIZATION METHODS
   * ================================================================================
   */

  /**
   * Check if user can perform an action in a specific project
   * Returns permission resolution with reason
   *
   * Permission check flow:
   * 1. Verify workspace membership (prerequisite)
   * 2. Verify project membership
   * 3. Get all project roles assigned to user
   * 4. Compute union of permissions from all roles
   * 5. Check if action is in permission set
   */
  async getProjectPermission(
    userId: number,
    projectId: number,
    action: ProjectPermissionAction
  ): Promise<PermissionResolution> {
    try {
      // Step 1: Get project to find workspace
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, workspaceId: true },
      });

      if (!project) {
        return {
          allowed: false,
          reason: 'project_not_found',
          resolvedAt: Date.now(),
        };
      }

      // Step 2: Check workspace membership
      const workspaceMember = await prisma.workspaceMember.findUnique({
        where: {
          uk_workspace_user: {
            workspaceId: project.workspaceId,
            userId,
          },
        },
        select: { id: true, role: true, workspaceId: true },
      });

      if (!workspaceMember) {
        return {
          allowed: false,
          reason: 'not_workspace_member',
          resolvedAt: Date.now(),
        };
      }

      // Step 3: Check project membership
      const projectMember = await prisma.projectMember.findUnique({
        where: {
          uk_project_user: {
            projectId,
            userId,
          },
        },
        select: { id: true, isActive: true },
      });

      if (!projectMember || !projectMember.isActive) {
        return {
          allowed: false,
          reason: 'not_project_member',
          resolvedAt: Date.now(),
        };
      }

      // Step 4: Get all project roles assigned to this user
      const projectMemberRoles = await prisma.projectMemberRole.findMany({
        where: {
          projectMemberId: projectMember.id,
        },
        select: { role: true },
      });

      if (projectMemberRoles.length === 0) {
        // User has no project roles
        return {
          allowed: false,
          reason: 'no_project_roles',
          resolvedAt: Date.now(),
        };
      }

      // Step 5: Compute union of permissions from all roles
      const roles = projectMemberRoles.map((pmr) => pmr.role as ProjectRoleEnum);
      const permissions = getPermissionsForRoles(roles);

      // Step 6: Check if action is allowed
      const isAllowed = permissions.has(action);

      return {
        allowed: isAllowed,
        reason: isAllowed ? 'project_role_permission' : 'permission_denied',
        resolvedAt: Date.now(),
      };
    } catch (error) {
      logger.error('Project permission check failed', {
        userId: userId.toString(),
        projectId: projectId.toString(),
        action,
        error,
      });
      throw error;
    }
  }

  /**
   * Check project permission and throw if denied
   */
  async requireProjectPermission(
    userId: number,
    projectId: number,
    action: ProjectPermissionAction
  ): Promise<void> {
    const result = await this.getProjectPermission(userId, projectId, action);

    if (!result.allowed) {
      logger.warn('Project permission denied', {
        userId: userId.toString(),
        projectId: projectId.toString(),
        action,
        reason: result.reason,
      });
      throw new ForbiddenError(`Permission denied: ${action}`);
    }
  }

  /**
   * Get all project roles assigned to a user in a specific project
   */
  async getProjectRoles(userId: number, projectId: number): Promise<ProjectRoleEnum[]> {
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        uk_project_user: {
          projectId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!projectMember) {
      return [];
    }

    const memberRoles = await prisma.projectMemberRole.findMany({
      where: {
        projectMemberId: projectMember.id,
      },
      select: { role: true },
    });

    return memberRoles.map((mr) => mr.role as ProjectRoleEnum);
  }

  /**
   * Get all effective permissions for a user in a project
   * Useful for frontend to determine UI capabilities
   */
  async getProjectEffectivePermissions(
    userId: number,
    projectId: number
  ): Promise<Set<ProjectPermissionAction>> {
    const roles = await this.getProjectRoles(userId, projectId);
    return getPermissionsForRoles(roles);
  }

  /**
   * Assign one or more project roles to a user
   * User must already be a project member
   */
  async assignProjectRoles(
    assignedByUserId: number,
    projectId: number,
    userId: number,
    rolesToAdd: ProjectRoleEnum[]
  ): Promise<void> {
    // Verify assigner has permission to manage project members
    await this.requireProjectPermission(
      assignedByUserId,
      projectId,
      ProjectPermissionAction.MEMBERS_VIEW // Can expand with role management permission
    );

    // Get or verify project member exists
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        uk_project_user: {
          projectId,
          userId,
        },
      },
      select: { id: true, projectId: true, workspaceId: true },
    });

    if (!projectMember) {
      throw new ForbiddenError('User is not a project member');
    }

    // Assign each role (upsert to handle idempotency)
    for (const role of rolesToAdd) {
      await prisma.projectMemberRole.upsert({
        where: {
          uk_project_member_role: {
            projectMemberId: projectMember.id,
            role,
          },
        },
        create: {
          projectMemberId: projectMember.id,
          role,
          assignedByUserId,
        },
        update: {
          assignedByUserId,
          assignedAt: new Date(),
        },
      });
    }

    logger.info('Project roles assigned', {
      assignedBy: assignedByUserId.toString(),
      userId: userId.toString(),
      projectId: projectId.toString(),
      roles: rolesToAdd,
    });
  }

  /**
   * Remove project roles from a user
   */
  async removeProjectRoles(
    removedByUserId: number,
    projectId: number,
    userId: number,
    rolesToRemove: ProjectRoleEnum[]
  ): Promise<void> {
    // Verify remover has permission
    await this.requireProjectPermission(
      removedByUserId,
      projectId,
      ProjectPermissionAction.MEMBERS_VIEW
    );

    // Get project member
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        uk_project_user: {
          projectId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!projectMember) {
      throw new ForbiddenError('User is not a project member');
    }

    // Delete role assignments
    for (const role of rolesToRemove) {
      await prisma.projectMemberRole.delete({
        where: {
          uk_project_member_role: {
            projectMemberId: projectMember.id,
            role,
          },
        },
      }).catch(() => {
        // Silently ignore if role wasn't assigned
      });
    }

    logger.info('Project roles removed', {
      removedBy: removedByUserId.toString(),
      userId: userId.toString(),
      projectId: projectId.toString(),
      roles: rolesToRemove,
    });
  }

  /**
   * Add user to a project and assign initial roles
   * Convenience method for onboarding
   */
  async addUserToProject(
    addedByUserId: number,
    projectId: number,
    userId: number,
    initialRoles: ProjectRoleEnum[]
  ): Promise<void> {
    if (initialRoles.length === 0) {
      throw new BadRequestError('At least one project role must be assigned');
    }

    // Verify project exists and get workspace
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      throw new BadRequestError('Project not found');
    }

    // Verify user is workspace member
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        uk_workspace_user: {
          workspaceId: project.workspaceId,
          userId,
        },
      },
    });

    if (!workspaceMember) {
      throw new BadRequestError('User must be a workspace member first');
    }

    // Add to project member if not already
    const projectMember = await prisma.projectMember.upsert({
      where: {
        uk_project_user: {
          projectId,
          userId,
        },
      },
      create: {
        projectId,
        workspaceId: project.workspaceId,
        userId,
        isActive: true,
        assignedByUserId: addedByUserId,
      },
      update: {
        isActive: true,
        assignedAt: new Date(),
        assignedByUserId: addedByUserId,
      },
      select: { id: true },
    });

    // Assign roles
    for (const role of initialRoles) {
      await prisma.projectMemberRole.upsert({
        where: {
          uk_project_member_role: {
            projectMemberId: projectMember.id,
            role,
          },
        },
        create: {
          projectMemberId: projectMember.id,
          role,
          assignedByUserId: addedByUserId,
        },
        update: {},
      });
    }

    logger.info('User added to project', {
      addedBy: addedByUserId.toString(),
      userId: userId.toString(),
      projectId: projectId.toString(),
      roles: initialRoles,
    });
  }

  /**
   * Auto-add OWNER and ADMIN workspace members to a newly created project
   * This ensures all workspace admins are automatically project members
   * Call this when a new project is created
   */
  async autoAddWorkspaceAdminsToProject(projectId: number, workspaceId: number): Promise<void> {
    // Get all OWNER and ADMIN workspace members
    const admins = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        role: {
          in: ['OWNER', 'ADMIN'],
        },
      },
      select: { id: true, userId: true },
    });

    if (admins.length === 0) {
      logger.info('No workspace admins to add to project', {
        projectId: projectId.toString(),
        workspaceId: workspaceId.toString(),
      });
      return;
    }

    // Add each admin as project member with default roles
    const defaultRoles = [ProjectRoleEnum.EDITOR, ProjectRoleEnum.PUBLISHER];

    for (const admin of admins) {
      try {
        // Create project member entry
        const projectMember = await prisma.projectMember.upsert({
          where: {
            uk_project_user: {
              projectId,
              userId: admin.userId,
            },
          },
          create: {
            projectId,
            workspaceId,
            userId: admin.userId,
            isActive: true,
          },
          update: {
            isActive: true,
          },
          select: { id: true },
        });

        // Assign default roles
        for (const role of defaultRoles) {
          await prisma.projectMemberRole.upsert({
            where: {
              uk_project_member_role: {
                projectMemberId: projectMember.id,
                role,
              },
            },
            create: {
              projectMemberId: projectMember.id,
              role,
            },
            update: {},
          });
        }
      } catch (error) {
        logger.error('Failed to auto-add admin to project', {
          adminId: admin.userId.toString(),
          projectId: projectId.toString(),
          error,
        });
        throw error;
      }
    }

    logger.info('Workspace admins auto-added to project', {
      projectId: projectId.toString(),
      workspaceId: workspaceId.toString(),
      count: admins.length,
    });
  }
}

export const authorizationService = new AuthorizationService();
