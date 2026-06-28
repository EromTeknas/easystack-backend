import {
  AuthorizationCache,
} from "../types/authorization.type";

import { getAuthorizationCache } from "./get-authorization.cache";
import { setAuthorizationCache } from "./set-authorization.cache";
import { deleteAuthorizationCache } from "./delete-authorization.cache";

export class AuthorizationCacheService {
  static async get(
    userId: string,
  ): Promise<AuthorizationCache | null> {
    return getAuthorizationCache(userId);
  }

  static async set(
    authorization: AuthorizationCache,
  ): Promise<void> {
    return setAuthorizationCache(authorization);
  }

  static async invalidate(
    userId: string,
  ): Promise<void> {
    return deleteAuthorizationCache(userId);
  }
}