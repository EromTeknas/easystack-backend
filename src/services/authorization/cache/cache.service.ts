import { AuthorizationCache } from "../types/authorization.type";
import * as CacheRepository from "./cache.repository";

export class AuthorizationCacheService {
  static async get(
    userId: string,
  ): Promise<AuthorizationCache | null> {
    return CacheRepository.getAuthorizationCache(userId);
  }

  static async set(
    authorization: AuthorizationCache,
  ): Promise<void> {
    return CacheRepository.setAuthorizationCache(authorization);
  }

  static async exists(
    userId: string,
  ): Promise<boolean> {
    return CacheRepository.authorizationCacheExists(userId);
  }

  static async evict(
    userId: string,
  ): Promise<void> {
    return CacheRepository.deleteAuthorizationCache(userId);
  }
}