import {
  AuthorizationCache,
  AuthorizationNode,
} from "../types/authorization.type";

import { AuthorizationRepository } from "../repositories/authorization.repository";

import { PermissionResolver } from "./resolve-permissions";
import logger from "../../../logger";

export class AuthorizationBuilder {
  constructor(private readonly repository: AuthorizationRepository) {}

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
      const resolvedPermissions = PermissionResolver.resolve({
        permissions: assignment.permissions,
        customPermissions: assignment.customPermissions,
        deniedPermissions: assignment.deniedPermissions,
      });

      const existingNode = cache.authorization[assignment.scope][assignment.scopeId];
      
      if (existingNode) {
        // Merge with existing node
        existingNode.roles = Array.from(new Set([...existingNode.roles, ...assignment.roles]));
        existingNode.permissions = Array.from(new Set([...existingNode.permissions, ...resolvedPermissions]));
        existingNode.updatedAt = now;
      } else {
        // Create new node
        cache.authorization[assignment.scope][assignment.scopeId] = {
          roles: assignment.roles,
          permissions: resolvedPermissions,
          version: 1,
          updatedAt: now,
        };
      }
    }

    return cache;
  }
}
