import {
  AuthorizationCache,
  AuthorizationNode,
} from "../types/authorization.type";

import { AuthorizationRepository } from "../repositories/authorization.repository";

import { PermissionResolver } from "./resolve-permissions";

import { RoleRegistry } from "../configs/roles-registry.config";

export class AuthorizationBuilder {
  constructor(
    private readonly repository: AuthorizationRepository,
  ) {}

  async build(userId: string): Promise<AuthorizationCache> {
    const assignments = await this.repository.getAssignments(Number(userId));

    const authorization = Object.keys(RoleRegistry).reduce(
      (acc, scope) => {
        acc[scope as keyof typeof RoleRegistry] = {};
        return acc;
      },
      {} as AuthorizationCache["authorization"],
    );

    const cache: AuthorizationCache = {
      userId,
      authorization,
    };

    const now = Date.now();

    for (const assignment of assignments) {
      const node: AuthorizationNode = {
        roles: assignment.roles,

        permissions: PermissionResolver.resolve({
          scope: assignment.scope,

          roles: assignment.roles,

          customPermissions: assignment.customPermissions,

          deniedPermissions: assignment.deniedPermissions,
        }),

        version: 1,

        updatedAt: now,
      };

      cache.authorization[assignment.scope][assignment.scopeId] = node;
    }

    return cache;
  }
}