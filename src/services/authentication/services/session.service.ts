import { UserStatus } from "@prisma/client";

import { UnauthorizedError } from "../../../errors";
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
