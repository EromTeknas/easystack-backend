import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '../config/auth';
import { app } from '../config';

const TOKEN_AUDIENCE = 'easystack-frontend';
const CLOCK_SKEW_SECONDS = 10;

export type AccessTokenClaims = {
  sub: string;
  type: string;
  iat: number;
  nbf: number;
  exp: number;
  iss?: string;
  aud?: string | string[];
};

export type RefreshTokenClaims = {
  sub: string;
  jti: string;
  type: string;
  iat: number;
  nbf: number;
  exp: number;
  iss?: string;
  aud?: string | string[];
};

const buildSignOptions = (expiresIn: number, subject: string): SignOptions => ({
  expiresIn,
  issuer: app.name,
  audience: TOKEN_AUDIENCE,
  subject
});

const buildTimingClaims = () => {
  const now = Math.floor(Date.now() / 1000);
  return { iat: now, nbf: now - CLOCK_SKEW_SECONDS };
};

const verifyToken = <T>(token: string, secret: string): T =>
  jwt.verify(token, secret, {
    issuer: app.name,
    audience: TOKEN_AUDIENCE,
    clockTolerance: CLOCK_SKEW_SECONDS
  }) as T;

/**
 * Generate access token (short-lived, for API requests)
 */
export const generateAccessToken = (userId: string): string => {
  return jwt.sign(
    {
      type: auth.cookies.accessTokenName,
      ...buildTimingClaims()
    },
    auth.jwtSecret,
    buildSignOptions(auth.accessTokenExpirySeconds, userId)
  );
};

/**
 * Generate refresh token (long-lived, for obtaining new access tokens)
 */
export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    {
      jti: uuidv4(),
      type: auth.cookies.refreshTokenName,
      ...buildTimingClaims()
    },
    auth.jwtRefreshSecret,
    buildSignOptions(auth.refreshTokenExpirySeconds, userId)
  );
};

/**
 * Verify and decode access token
 */
export const verifyAccessToken = (token: string): AccessTokenClaims => {
  try {
    const decoded = verifyToken<AccessTokenClaims>(token, auth.jwtSecret);

    if (decoded.type !== auth.cookies.accessTokenName) {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Verify and decode refresh token
 */
export const verifyRefreshToken = (token: string): RefreshTokenClaims => {
  try {
    const decoded = verifyToken<RefreshTokenClaims>(token, auth.jwtRefreshSecret);

    if (decoded.type !== auth.cookies.refreshTokenName) {
      throw new Error('Invalid token type');
    }

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};
