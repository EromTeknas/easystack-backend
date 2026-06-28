import { RoleRegistry } from "../configs/roles-registry.config";

// ============================================================================
// 1. TYPES: Strongly typed Role Keys
// ============================================================================

export type WorkspaceRoleKey = keyof typeof RoleRegistry.workspace;
export type ProjectRoleKey = keyof typeof RoleRegistry.project;

// A union of every role key in the system (e.g., "WORKSPACE_OWNER" | "PROJECT_ADMIN" | ...)
export type AppRoleKey = WorkspaceRoleKey | ProjectRoleKey;


// ============================================================================
// 2. RUNTIME ARRAYS (Useful for Zod schemas, validation, or Prisma queries)
// ============================================================================

export const WORKSPACE_ROLE_KEYS = Object.keys(
  RoleRegistry.workspace
) as readonly WorkspaceRoleKey[];

export const PROJECT_ROLE_KEYS = Object.keys(
  RoleRegistry.project
) as readonly ProjectRoleKey[];

export const ALL_ROLE_KEYS = [
  ...WORKSPACE_ROLE_KEYS,
  ...PROJECT_ROLE_KEYS,
] as const;


// ============================================================================
// 3. ENUM-LIKE OBJECTS (Useful for exact string matching in logic)
// ============================================================================

// Creates an object like: { WORKSPACE_OWNER: "WORKSPACE_OWNER", ... }
export const APP_ROLES = {
  WORKSPACE: Object.fromEntries(
    WORKSPACE_ROLE_KEYS.map((key) => [key, key])
  ) as Record<WorkspaceRoleKey, WorkspaceRoleKey>,

  PROJECT: Object.fromEntries(
    PROJECT_ROLE_KEYS.map((key) => [key, key])
  ) as Record<ProjectRoleKey, ProjectRoleKey>,
} as const;