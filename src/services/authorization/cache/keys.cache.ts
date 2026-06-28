import { AUTHORIZATION_CACHE_PREFIX } from "./constants.cache";

export class AuthorizationCacheKeys {
  /**
   * authorization:userId
   *
   * Example:
   * authorization:usr_123
   */
  static user(userId: string): string {
    return `${AUTHORIZATION_CACHE_PREFIX}:${userId}`;
  }
}