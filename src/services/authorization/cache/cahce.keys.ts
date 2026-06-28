import {
  AUTHORIZATION_CACHE_PREFIX,
  AUTHORIZATION_CACHE_VERSION,
} from "./constants.cache";

export class AuthorizationCacheKeys {
  /**
   * authorization:v1:userId
   *
   * Example:
   * authorization:v1:usr_123
   */
  static user(userId: string): string {
    return `${AUTHORIZATION_CACHE_PREFIX}:${AUTHORIZATION_CACHE_VERSION}:${userId}`;
  }
}