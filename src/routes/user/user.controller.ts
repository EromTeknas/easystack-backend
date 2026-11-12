import { Response } from "express";
import { z } from "zod";
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

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name cannot be empty").max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  avatarUrl: z.string().url("Invalid avatar URL").nullable().optional(),
});

/**
 * GET /api/user/profile
 * Get current authenticated user profile
 */
export const getProfile = asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const profile = await UserService.getProfile(userId);
  return ok(res, { profile });
});

/**
 * PATCH /api/user/profile
 * Update current authenticated user profile
 */
export const updateProfile = asyncHandler(async (req: any, res: Response) => {
  const userId = req.user.id;
  const parsed = updateProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i: any) => i.message).join(", ");
    throw new BadRequestError(errorMsg);
  }

  const profile = await UserService.updateProfile(userId, parsed.data);
  return ok(res, { profile, message: "Profile updated successfully" });
});
