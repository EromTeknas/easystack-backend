import { AuthorizationScope } from "../configs/roles-registry.config";

export interface AuthorizationNode {
  roles: string[];

  permissions: Set<string>;

  version: number;

  updatedAt: number;
}

export type AuthorizationScopes = {
  [K in AuthorizationScope]: Record<string, AuthorizationNode>;
};

export interface AuthorizationCache {
  userId: string;

  authorization: AuthorizationScopes;
}