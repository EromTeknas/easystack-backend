import { AuthorizationScope } from "../configs/roles-registry.config";

export interface AuthorizationAssignment {
  scope: AuthorizationScope;

  scopeId: string;

  roles: string[];

  customPermissions: string[];

  deniedPermissions: string[];
}

export interface AuthorizationRepository {
  getAssignments(
    userId: number,
  ): Promise<AuthorizationAssignment[]>;
}