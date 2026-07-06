/**
 * Email Verification Controller
 * POST /auth/verify-email
 *
 * Verifies user's email with OTP and grants login access
 */

import { asyncHandler } from "../../utils/asyncHandler";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt";
import { hashToken } from "../../utils/password";
import {
  BadRequestError,
  UnauthorizedError,
  InternalServerError,
  NotFoundError,
} from "../../errors";
import { prisma } from "../../db";
import logger from "../../utils/logger";
import { ok } from "../../utils/response";
import { enqueueSendWelcomeEmailJob } from "../../queues/welcome-email.queue";
import { auth } from "../../config/auth";
import { getClientIP, getDeviceName } from "../../utils/validation";
import {
  getEmailVerificationRecord,
  deleteEmailVerificationToken,
} from "../../services/email-verification-redis.service";
import { verifyOtp } from "../../utils/otp";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "../../utils/auth-cookies";
import { randomUUID } from "crypto";
import { APP_ROLES } from "../../services/authorization/constants/role.constants";
import { UserStatus } from "@prisma/client";
import { RoleRepository } from "../../repositories/role.repository";
import { BillingService } from "../../services/billing.service";

export const verifyEmailController = asyncHandler(async (req, res) => {
  logger.info("POST /api/auth/verify-email start");
  try {
    const { verificationToken, otpCode } = req.body;

    // Validate input
    if (!verificationToken || typeof verificationToken !== "string") {
      throw new BadRequestError("verificationToken is required");
    }

    if (!otpCode || typeof otpCode !== "string") {
      throw new BadRequestError("otpCode is required");
    }

    try {
      // Get user
      // Resolve verification token from Redis (maps token -> user + email + otpHash + purpose)
      const verificationRecord =
        await getEmailVerificationRecord(verificationToken);

      if (
        !verificationRecord ||
        verificationRecord.purpose !== "EMAIL_VERIFICATION"
      ) {
        throw new UnauthorizedError("Invalid or expired verification token");
      }

      // Validate OTP against stored hash
      const isValidOtp = await verifyOtp(otpCode, verificationRecord.otpHash);

      if (!isValidOtp) {
        throw new UnauthorizedError("Invalid OTP code");
      }

      // OTP is valid - consume the verification token to prevent reuse
      await deleteEmailVerificationToken(verificationToken);

      const userId = Number(verificationRecord.userId);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          emailVerified: true,
          status: true,
          onboardingCompleted: true,
        },
      });

      if (!user) {
        throw new NotFoundError("User not found");
      }

      // Check if already verified
      if (user.emailVerified) {
        return ok(res, {
          message: "Email already verified",
          verified: true,
        });
      }

      // Transactional: Mark verified, create workspace, create refresh token
      const result = await prisma.$transaction(async (tx) => {
        /**
         * Step 1
         * Activate user
         */
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            emailVerified: true,
            status: UserStatus.ACTIVE,
          },
        });

        logger.info("User email marked as verified", {
          userId,
        });

        /**
         * Step 2
         * Create default workspace (if it doesn't exist)
         */
        const existingMembership = await tx.workspaceMember.findFirst({
          where: {
            userId,
          },
        });

        if (!existingMembership) {
          const ownerRole = await RoleRepository.findByKey(
            APP_ROLES.WORKSPACE.WORKSPACE_OWNER,
          );

          if (!ownerRole) {
            throw new InternalServerError(
              "Workspace owner role not found. Ensure roles are seeded.",
            );
          }

          const workspace = await tx.workspace.create({
            data: {
              name: `${updatedUser.firstName}'s Workspace`,
              createdById: updatedUser.id,
            },
          });

          await tx.workspaceMember.create({
            data: {
              workspaceId: workspace.id,
              userId: updatedUser.id,
              roleId: ownerRole.id,
            },
          });

          logger.info("Default workspace created", {
            workspaceId: workspace.id,
            userId,
          });
        }

        /**
         * Step 3
         * Generate authentication tokens
         */
        const accessToken = generateAccessToken(userId.toString());
        const refreshToken = generateRefreshToken(userId.toString());
        const refreshTokenHash = await hashToken(refreshToken);
        const familyId = randomUUID();

        const expiresAt = new Date(
          Date.now() + auth.refreshTokenExpirySeconds * 1000,
        );

        await tx.refreshToken.create({
          data: {
            userId,
            familyId,
            tokenHash: refreshTokenHash,
            expiresAt,
            ipAddress: getClientIP(req),
            userAgent: (req.headers["user-agent"] as string) ?? "Unknown",
            deviceName: getDeviceName(
              (req.headers["user-agent"] as string) ?? "",
            ),
          },
        });

        logger.info("Refresh token created", {
          userId,
          familyId,
        });

        return {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            onboardingCompleted: updatedUser.onboardingCompleted,
          },
          accessToken,
          refreshToken,
        };
      });

      // Enqueue welcome email job (event-based, outside transaction)
      await enqueueSendWelcomeEmailJob({
        email: user.email,
        firstName: user.firstName || "",
      });

      // Log verification
      logger.info("User email verified successfully", {
        userId,
        email: user.email,
        ipAddress: getClientIP(req),
      });

      // Set auth cookies (access + refresh)
      setAccessTokenCookie(res, result.accessToken);
      setRefreshTokenCookie(res, result.refreshToken);

      // Fire-and-forget cache warm-up. 
      // No need to 'await' it; let it run in the background so it doesn't slow down the login response.
      BillingService.get(Number(userId)).catch((err) => 
        logger.error('Failed to warm billing cache post-login', { userId, error: err.message })
      );
      
      // Return response with tokens
      return ok(res, {
        user: result.user,
        verified: true,
        message: "Email verified successfully",
      });
    } catch (error: any) {
      logger.error("Email verification failed", {
        error: error.message,
      });

      if (
        error instanceof BadRequestError ||
        error instanceof UnauthorizedError ||
        error instanceof NotFoundError
      ) {
        throw error;
      }

      throw new InternalServerError("Email verification failed");
    }
  } finally {
    logger.info("POST /api/auth/verify-email end");
  }
});

/**
 * Resend OTP to user's email
 * POST /auth/resend-otp
 */
// Moved to resend-otp.controller.ts
