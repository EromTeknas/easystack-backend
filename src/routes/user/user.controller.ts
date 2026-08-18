import { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import redisClient from "../../db/redis";
import { BadRequestError } from "../../errors";
import logger from "../../utils/logger";
import { UserService } from "../../services/user/user.service";

/**
 * GET /api/user/search?query=...
 * Search users globally by email, firstName, lastName, or resourceId
 */
export const searchUsers = asyncHandler(async (req: any, res: Response) => {
  const query = req.query.query as string;

  if (!query || query.trim().length < 2) {
    throw new BadRequestError("Search query must be at least 2 characters long");
  }

  const normalizedQuery = query.trim().toLowerCase();
  const cacheKey = `users:search:${normalizedQuery}`;

  // Try Redis cache
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return ok(res, { users: JSON.parse(cached) });
    }
  } catch (err) {
    logger.warn("Failed to retrieve user search from Redis cache", { error: err });
  }

  // Database fallback via Service
  const users = await UserService.searchUsers(normalizedQuery);

  // Store in Redis (60 seconds cache)
  try {
    await redisClient.setex(cacheKey, 60, JSON.stringify(users));
  } catch (err) {
    logger.warn("Failed to cache user search results in Redis", { error: err });
  }

  return ok(res, { users });
});
