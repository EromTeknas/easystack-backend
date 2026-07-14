import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";

import { auth } from "../../../config/auth";
import { app } from "../../../config";

const TOKEN_AUDIENCE = "easystack-frontend";
const CLOCK_SKEW_SECONDS = 10;

export interface AccessTokenClaims {
  sub: string;
  type: "access";
  iat: number;
  nbf: number;
  exp: number;
}

export interface RefreshTokenClaims {
  sub: string;
  jti: string;
  type: "refresh";
  iat: number;
  nbf: number;
  exp: number;
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  refreshJti: string;
  familyId: string;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
}

export class TokenService {
  issuePair(userId: number, familyId: string = randomUUID()): IssuedTokenPair {
    const subject = userId.toString();
    const refreshJti = randomUUID();
    const timing = this.buildTimingClaims();

    const accessToken = jwt.sign(
      {
        type: "access",
        ...timing,
      },
      auth.jwtSecret,
      this.buildSignOptions(auth.accessTokenExpirySeconds, subject),
    );

    const refreshToken = jwt.sign(
      {
        jti: refreshJti,
        type: "refresh",
        ...timing,
      },
      auth.jwtRefreshSecret,
      this.buildSignOptions(auth.refreshTokenExpirySeconds, subject),
    );

    return {
      accessToken,
      refreshToken,
      refreshJti,
      familyId,
      refreshTokenHash: this.hashRefreshToken(refreshToken),
      refreshExpiresAt: new Date(
        Date.now() + auth.refreshTokenExpirySeconds * 1000,
      ),
    };
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const claims = jwt.verify(token, auth.jwtSecret, {
      issuer: app.name,
      audience: TOKEN_AUDIENCE,
      clockTolerance: CLOCK_SKEW_SECONDS,
    }) as AccessTokenClaims;

    if (claims.type !== "access") {
      throw new Error("Invalid token type");
    }

    return claims;
  }

  verifyRefreshToken(token: string): RefreshTokenClaims {
    const claims = jwt.verify(token, auth.jwtRefreshSecret, {
      issuer: app.name,
      audience: TOKEN_AUDIENCE,
      clockTolerance: CLOCK_SKEW_SECONDS,
    }) as RefreshTokenClaims;

    if (claims.type !== "refresh" || !claims.jti) {
      throw new Error("Invalid token type");
    }

    return claims;
  }

  matchesRefreshToken(token: string, storedHash: string): boolean {
    const actual = Buffer.from(this.hashRefreshToken(token), "hex");
    const expected = Buffer.from(storedHash, "hex");

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private buildSignOptions(expiresIn: number, subject: string): SignOptions {
    return {
      expiresIn,
      issuer: app.name,
      audience: TOKEN_AUDIENCE,
      subject,
    };
  }

  private buildTimingClaims() {
    const now = Math.floor(Date.now() / 1000);
    return { iat: now, nbf: now - CLOCK_SKEW_SECONDS };
  }
}
