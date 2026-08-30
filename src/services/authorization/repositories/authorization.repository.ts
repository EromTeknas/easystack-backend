import { prisma } from "../../../db";
import { AuthorizationScope } from "../configs/roles-registry.config";
import { findPermissions } from "./role-permission.repository";
import { findByWorkspaceAndUser, findWorkspacesByUser } from "./workspace-member.repository";
import { findByProjectAndWorkspaceMember, findProjectsByUser } from "./project-member.repository";

export interface AuthorizationAssignment {
  scope: AuthorizationScope;

  scopeId: string;

  roles: string[];

  permissions: string[];

  customPermissions: string[];

  deniedPermissions: string[];
}

export class AuthorizationRepository {
  async getAssignments(userId: number): Promise<AuthorizationAssignment[]> {
    const assignments: AuthorizationAssignment[] = [];

    /**
     * --------------------------------------------------------------------------
     * Workspace Assignments
     * --------------------------------------------------------------------------
     */

    const workspaceMembers = await findWorkspacesByUser(userId);

    for (const workspaceMember of workspaceMembers) {
      assignments.push({
        scope: "workspace",
        scopeId: workspaceMember.workspaceId.toString(),

        roles: [workspaceMember.role.key],

        permissions: workspaceMember.role.permissions.map(
          (rp) => rp.permission.key,
        ),

        customPermissions: [],

        deniedPermissions: [],
      });
    }

    /**
     * --------------------------------------------------------------------------
     * Project Assignments
     * --------------------------------------------------------------------------
     */

    for (const workspaceMember of workspaceMembers) {
      const projectMembers = await findProjectsByUser(
        workspaceMember.userId,
      );

      // Track which projects they have explicit assignments for
      const explicitProjectIds = new Set(projectMembers.map(pm => pm.projectId));

      for (const projectMember of projectMembers) {
        assignments.push({
          scope: "project",
          scopeId: projectMember.projectId.toString(),
          roles: [projectMember.role.key],
          permissions: projectMember.role.permissions.map((rp) => rp.permission.key),
          customPermissions: [],
          deniedPermissions: [],
        });
      }

      // IMPLICIT INHERITANCE: If Workspace Admin or Owner, inject all remaining projects in the workspace!
      if (workspaceMember.role.key === 'WORKSPACE_OWNER' || workspaceMember.role.key === 'WORKSPACE_ADMIN') {
        const allWorkspaceProjects = await prisma.project.findMany({
          where: { workspaceId: workspaceMember.workspaceId },
          select: { id: true }
        });

        // We need to give them the equivalent PROJECT role permissions.
        // We will fetch the PROJECT_ADMIN role from DB to get its exact permissions.
        const projectAdminRole = await prisma.role.findUnique({
          where: { key: workspaceMember.role.key === 'WORKSPACE_OWNER' ? 'PROJECT_OWNER' : 'PROJECT_ADMIN' },
          include: { permissions: { include: { permission: true } } }
        });

        if (projectAdminRole) {
          const adminPermissions = projectAdminRole.permissions.map(rp => rp.permission.key);
          
          for (const proj of allWorkspaceProjects) {
            if (!explicitProjectIds.has(proj.id)) {
              assignments.push({
                scope: "project",
                scopeId: proj.id.toString(),
                roles: [projectAdminRole.key],
                permissions: adminPermissions,
                customPermissions: [],
                deniedPermissions: [],
              });
            }
          }
        }
      }
    } 

    return assignments;
  }

  // Not being used currently, but can be used in the future to get a specific authorization assignment for a workspace
  async getWorkspaceAuthorization(
    workspaceId: number,
    userId: number,
  ): Promise<AuthorizationAssignment | null> {
    const workspaceMember = await findByWorkspaceAndUser(workspaceId, userId);

    if (!workspaceMember) {
      return null;
    }

    const rolePermissions = await findPermissions(workspaceMember.roleId);

    return {
      scope: "workspace",
      scopeId: workspaceId.toString(),

      roles: [workspaceMember.role.key],

      permissions: rolePermissions.map((rp) => rp.permission.key),

      customPermissions: [],

      deniedPermissions: [],
    };
  }

  // Not being used currently, but can be used in the future to get a specific authorization assignment for a project
  async getProjectAuthorization(
    workspaceId: number,
    projectId: number,
    userId: number,
  ): Promise<AuthorizationAssignment | null> {
    const workspaceMember = await findByWorkspaceAndUser(workspaceId, userId);

    if (!workspaceMember) {
      return null;
    }

    const projectMember = await findByProjectAndWorkspaceMember(
      projectId,
      workspaceMember.userId,
    );

    if (!projectMember) {
      return null;
    }

    const rolePermissions = await findPermissions(projectMember.roleId);

    return {
      scope: "project",
      scopeId: projectId.toString(),

      roles: [projectMember.role.key],

      permissions: rolePermissions.map((rp) => rp.permission.key),

      customPermissions: [],

      deniedPermissions: [],
    };
  }
}
