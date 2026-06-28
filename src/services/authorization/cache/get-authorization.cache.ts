import redis from "../../../config/redis";

import { AuthorizationCache } from "../types/authorization.type";
import { AuthorizationCacheKeys } from "./keys.cache";

export async function getAuthorizationCache(
  userId: string,
): Promise<AuthorizationCache | null> {
  const cache = await redis.get(
    AuthorizationCacheKeys.user(userId),
  );

  if (!cache) {
    return null;
  }

  return JSON.parse(cache) as AuthorizationCache;
}