import {
  AuthorizationCache,
  AuthorizationNode,
} from "../types/authorization.type";

import { AuthorizationRepository } from "../repositories/authorization.repository";

import { PermissionResolver } from "./resolve-permissions";

export class AuthorizationBuilder {
  constructor(
    private readonly repository: AuthorizationRepository,
  ) {}

  async build(userId: string): Promise<AuthorizationCache> {
    const assignments = await this.repository.getAssignments(Number(userId));

    const cache: AuthorizationCache = {
      userId,
      authorization: {
        workspace: {},
        project: {},
      },
    };

    const now = Date.now();

    for (const assignment of assignments) {
      const node: AuthorizationNode = {
        roles: assignment.roles,

        permissions: new Set<string>(PermissionResolver.resolve({
          permissions: assignment.permissions,

          customPermissions: assignment.customPermissions,

          deniedPermissions: assignment.deniedPermissions,
        })),

        version: 1,

        updatedAt: now,
      };

      cache.authorization[assignment.scope][assignment.scopeId] = node;
    }

    return cache;
  }
}