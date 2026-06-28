import redis from "../../../config/redis";

import { AuthorizationCacheKeys } from "./keys.cache";

export async function deleteAuthorizationCache(
  userId: string,
): Promise<void> {
  await redis.del(
    AuthorizationCacheKeys.user(userId),
  );
}