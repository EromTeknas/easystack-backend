import redis from "../../../config/redis";

import { AuthorizationCache } from "../types/authorization.type";
import { AuthorizationCacheKeys } from "./cahce.keys";

export async function getAuthorizationCache(
  userId: string,
): Promise<AuthorizationCache | null> {
  const cache = await redis.get(
    AuthorizationCacheKeys.user(userId),
  );

  if (!cache) {
    return null;
  }

  try {
    return JSON.parse(cache) as AuthorizationCache;
  } catch {
    return null;
  }
}

export async function setAuthorizationCache(
  authorization: AuthorizationCache,
): Promise<void> {
  const payload = JSON.stringify(authorization);

  await redis.set(
    AuthorizationCacheKeys.user(authorization.userId),
    payload,
  );
}

export async function deleteAuthorizationCache(
  userId: string,
): Promise<void> {
  await redis.del(
    AuthorizationCacheKeys.user(userId),
  );
}

export async function authorizationCacheExists(
  userId: string,
): Promise<boolean> {
  const exists = await redis.exists(
    AuthorizationCacheKeys.user(userId),
  );

  return exists === 1;
}