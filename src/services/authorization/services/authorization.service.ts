// AuthorizationService.get(userId)

import { AuthorizationCacheService } from "../cache/cache.service";
import { AuthorizationRepository } from "../repositories/authorization.repository";
import {
  AuthorizationCache,
  AuthorizationNode,
} from "../types/authorization.type";
import { AuthorizationBuilder } from "./buid-cache.service";
import { AuthorizationScope } from "../configs/roles-registry.config";
import { AppRoleKey } from "../constants/role.constants";
// AuthorizationService.rebuild(userId)

// AuthorizationService.invalidate(userId)

// AuthorizationService.can(...)
const repository = new AuthorizationRepository();
const builder = new AuthorizationBuilder(repository);
class AuthorizationService {
  static async get(userId: string): Promise<AuthorizationCache> {
    // let cache = await AuthorizationCacheService.get(userId);

    // if (!cache) {
      const cache = await this.rebuild(userId);
    // }

    return cache;
  }

  static async rebuild(userId: string): Promise<AuthorizationCache> {
    const cache = await builder.build(userId);

    await AuthorizationCacheService.set(cache);

    return cache;
  }

  static async invalidate(userId: string): Promise<void> {
    await AuthorizationCacheService.evict(userId);
  }

  static async can(
    userId: string,
    permission: string,
    scope: AuthorizationScope,
    scopeId: string,
  ): Promise<boolean> {
    const node = await this.getNode(userId, scope, scopeId);
    return this.hasPermission(node, permission);
  }

  private static hasPermission(
    node: AuthorizationNode | null,
    permission: string,
  ) {
    return new Set(node?.permissions ?? []).has(permission);
  }

  static async getNode(
    userId: string,
    scope: AuthorizationScope,
    scopeId: string,
  ): Promise<AuthorizationNode | null> {
    const cache = await this.get(userId);

    return cache.authorization[scope][scopeId] ?? null;
  }

  static async hasRole(
    userId: string,
    scope: AuthorizationScope,
    scopeId: string,
    role: AppRoleKey,
  ): Promise<boolean> {
    const node = await this.getNode(userId, scope, scopeId);

    if (!node) {
      return false;
    }

    return node.roles.includes(role);
  }
}

export { AuthorizationService };
