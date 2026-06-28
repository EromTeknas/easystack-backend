import { asyncHandler } from "../../utils/asyncHandler";
import { verifyRefreshToken } from "../../utils/jwt";
import { InternalServerError } from "../../errors";
import { prisma } from "../../db";
import logger from "../../utils/logger";
import { auth } from "../../config/auth";
import { clearAuthCookies } from "../../utils/auth-cookies";
import { ok } from "../../utils/response";
import { Prisma } from "@prisma/client";
import { log } from "node:console";

/**
 * Logout user by revoking refresh token
 * POST /auth/logout
 */
export const logoutController = asyncHandler(async (req, res) => {
  logger.info("POST /api/auth/logout start");
  const { logoutFromAllDevices = true } = req.body;
  try {
    const refreshToken = req.cookies?.[auth.cookies.refreshTokenName];

    if (!refreshToken) {
      // Even without a token, respond with success
      clearAuthCookies(res);
      return ok(res, {
        message: "Logged out successfully",
      });
    }

    // Verify token to get user ID
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      // Token is invalid or expired, just clear cookie
      clearAuthCookies(res);
      return ok(res, {
        message: "Logged out successfully",
      });
    }

    const userId = Number(decoded.sub);
    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        userId,
        revokedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const whereClause: Prisma.RefreshTokenWhereInput = {
      revokedAt: null,
    };

    const familyId = tokenRecord?.familyId;

    // Only add familyId if it is actually a string
    if (familyId && !logoutFromAllDevices) {
      whereClause.familyId = familyId;
    } else if (logoutFromAllDevices) {
      whereClause.userId = userId;
    }
    
    // Revoke all refresh tokens for this user
    await prisma.refreshToken.updateMany({
      where: whereClause,
      data: {
        revokedAt: new Date(),
      },
    });

    logger.info("User logged out", {
      userId,
    });

    // Clear refresh token cookie
    clearAuthCookies(res);

    return ok(res, {
      message: "Logged out successfully",
    });
  } catch (error: any) {
    logger.error("Logout failed", {
      error: error.message,
    });

    // Still clear cookie even if DB operation fails
    clearAuthCookies(res);

    throw new InternalServerError("Logout failed");
  } finally {
    logger.info("POST /api/auth/logout end");
  }
});
