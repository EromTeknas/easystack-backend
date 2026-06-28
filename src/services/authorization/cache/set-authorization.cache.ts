import redis from "../../../config/redis";

import { AuthorizationCache } from "../types/authorization.type";

import {
  AUTHORIZATION_CACHE_TTL,
} from "./constants.cache";

import { AuthorizationCacheKeys } from "./keys.cache";

export async function setAuthorizationCache(
  authorization: AuthorizationCache,
): Promise<void> {
  await redis.set(
    AuthorizationCacheKeys.user(
      authorization.userId,
    ),
    JSON.stringify(authorization),
    "EX",
    AUTHORIZATION_CACHE_TTL,
  );
}