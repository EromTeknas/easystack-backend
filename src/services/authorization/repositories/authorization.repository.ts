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
        workspaceMember.id,
      );

      for (const projectMember of projectMembers) {
        assignments.push({
          scope: "project",
          scopeId: projectMember.projectId.toString(),

          roles: [projectMember.role.key],

          permissions: projectMember.role.permissions.map(
            (rp) => rp.permission.key,
          ),

          customPermissions: [],

          deniedPermissions: [],
        });
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
      workspaceMember.id,
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
