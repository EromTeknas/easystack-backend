import { WorkspaceRoles } from "./workspace-roles.config";
import { ProjectRoles } from "./project-roles.config";

export const RoleRegistry = {
  workspace: WorkspaceRoles,
  project: ProjectRoles,
} as const;

export type AuthorizationScope = keyof typeof RoleRegistry;

export type RoleRegistryType = typeof RoleRegistry;