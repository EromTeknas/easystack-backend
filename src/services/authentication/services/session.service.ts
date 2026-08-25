import { UserStatus } from "@prisma/client";

import { BadRequestError, NotFoundError, UnauthorizedError } from "../../../errors";
import { AUTH_ERROR_CODES } from "../../../constants/errorCodes";
import logger from "../../../utils/logger";
import type {
  AuthUser,
  AuthenticatedSession,
  ClientContext,
} from "../types/authentication.types";
import { SessionRepository } from "../repositories/session.repository";
import { TokenService } from "./token.service";

export class SessionService {
  constructor(
    private readonly repository: SessionRepository,
    private readonly tokens: TokenService,
  ) {}

  async create(user: AuthUser, context: ClientContext): Promise<AuthenticatedSession> {
    this.assertUserCanAuthenticate(user);

    const issued = this.tokens.issuePair(user.id);

    await this.repository.create({
      userId: user.id,
      jti: issued.refreshJti,
      familyId: issued.familyId,
      tokenHash: issued.refreshTokenHash,
      expiresAt: issued.refreshExpiresAt,
      ...context,
    });

    return {
      user,
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
    };
  }

  async rotate(
    presentedRefreshToken: string,
    context: ClientContext,
  ): Promise<AuthenticatedSession> {
    let claims;

    try {
      claims = this.tokens.verifyRefreshToken(presentedRefreshToken);
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token", AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED);
    }

    const current = await this.repository.findByJti(claims.jti);

    if (!current) {
      throw new UnauthorizedError("Refresh token is invalid");
    }

    if (current.revokedAt) {
      await this.repository.revokeFamily(current.familyId);
      logger.warn("Refresh token reuse detected", {
        userId: current.userId,
        familyId: current.familyId,
        jti: current.jti,
      });
      throw new UnauthorizedError("Refresh token reuse detected");
    }

    if (
      current.expiresAt <= new Date() ||
      !this.tokens.matchesRefreshToken(presentedRefreshToken, current.tokenHash)
    ) {
      await this.repository.revokeFamily(current.familyId);
      throw new UnauthorizedError("Refresh token is invalid");
    }

    this.assertUserCanAuthenticate(current.user);

    const issued = this.tokens.issuePair(current.userId, current.familyId);

    const rotated = await this.repository.rotateAtomically({
      currentSessionId: current.id,
      newSession: {
        userId: current.userId,
        jti: issued.refreshJti,
        familyId: current.familyId,
        tokenHash: issued.refreshTokenHash,
        expiresAt: issued.refreshExpiresAt,
        ...context,
      },
    });

    if (!rotated) {
      await this.repository.revokeFamily(current.familyId);
      throw new UnauthorizedError("Refresh token reuse detected");
    }

    return {
      user: current.user,
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
    };
  }

  async logout(input: {
    refreshToken?: string | undefined;
    logoutFromAllDevices: boolean;
  }): Promise<void> {
    if (!input.refreshToken) {
      return;
    }

    let claims;

    try {
      claims = this.tokens.verifyRefreshToken(input.refreshToken);
    } catch {
      return;
    }

    const current = await this.repository.findByJti(claims.jti);

    if (!current) {
      return;
    }

    if (input.logoutFromAllDevices) {
      await this.repository.revokeAllForUser(current.userId);
      return;
    }

    await this.repository.revokeFamily(current.familyId);
  }

  async listActiveSessions(userId: number, currentRefreshToken?: string) {
    let currentJti: string | null = null;

    if (currentRefreshToken) {
      try {
        currentJti = this.tokens.verifyRefreshToken(currentRefreshToken).jti;
      } catch {
        currentJti = null;
      }
    }

    const sessions = await this.repository.findActiveSessionsByUserId(userId);

    return sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName ?? "Unknown device",
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: session.updatedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      isCurrent: currentJti !== null && session.jti === currentJti,
    }));
  }

  async revokeSessionForUser(
    userId: number,
    sessionId: number,
    currentRefreshToken?: string,
  ): Promise<{ message: string }> {
    const session = await this.repository.findActiveSessionByIdForUser(
      userId,
      sessionId,
    );

    if (!session) {
      throw new NotFoundError("Session not found or already revoked");
    }

    if (currentRefreshToken) {
      try {
        const currentJti = this.tokens.verifyRefreshToken(currentRefreshToken).jti;
        if (session.jti === currentJti) {
          throw new BadRequestError(
            "Cannot revoke the current session. Use logout instead.",
          );
        }
      } catch (error) {
        if (error instanceof BadRequestError) {
          throw error;
        }
      }
    }

    await this.repository.revokeFamily(session.familyId);

    return { message: "Session revoked successfully" };
  }

  async revokeOtherSessions(
    userId: number,
    currentRefreshToken: string | undefined,
  ): Promise<{ message: string; revokedCount: number }> {
    if (!currentRefreshToken) {
      throw new UnauthorizedError("Current session is required");
    }

    let currentJti: string;

    try {
      currentJti = this.tokens.verifyRefreshToken(currentRefreshToken).jti;
    } catch {
      throw new UnauthorizedError("Current session is invalid");
    }

    const current = await this.repository.findByJti(currentJti);

    if (!current || current.userId !== userId || current.revokedAt) {
      throw new UnauthorizedError("Current session is invalid");
    }

    const revokedCount = await this.repository.revokeAllExceptJti(
      userId,
      currentJti,
    );

    return {
      message:
        revokedCount > 0
          ? `Signed out of ${revokedCount} other session${revokedCount === 1 ? "" : "s"}`
          : "No other active sessions to revoke",
      revokedCount,
    };
  }

  async revokeOtherSessionsAfterPasswordChange(
    userId: number,
    currentRefreshToken: string | undefined,
  ): Promise<number> {
    if (!currentRefreshToken) {
      await this.repository.revokeAllForUser(userId);
      return -1;
    }

    try {
      const currentJti = this.tokens.verifyRefreshToken(currentRefreshToken).jti;
      return this.repository.revokeAllExceptJti(userId, currentJti);
    } catch {
      await this.repository.revokeAllForUser(userId);
      return -1;
    }
  }

  verifyAccessToken(accessToken: string) {
    try {
      return this.tokens.verifyAccessToken(accessToken);
    } catch (error: any) {
      if (error?.name === "TokenExpiredError") {
        throw new UnauthorizedError("Access token expired", AUTH_ERROR_CODES.ACCESS_TOKEN_EXPIRED);
      }

      throw new UnauthorizedError("Invalid token");
    }
  }

  private assertUserCanAuthenticate(user: AuthUser): void {
    if (
      user.status !== UserStatus.ACTIVE ||
      !user.emailVerified ||
      user.defaultWorkspaceId === null
    ) {
      throw new UnauthorizedError("User account is not active");
    }
  }
}
