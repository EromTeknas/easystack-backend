import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '../config/auth';

/**
 * Generate access token (short-lived, for API requests)
 */
export const generateAccessToken = (userId: string, email: string, role: string): string => {
  const signOptions: SignOptions = { expiresIn: auth.accessTokenExpiry as any };
  return jwt.sign(
    {
      sub: userId,
      email,
      role,
      type: 'access',
      iat: Math.floor(Date.now() / 1000)
    },
    auth.jwtSecret,
    signOptions
  );
};

/**
 * Generate refresh token (long-lived, for obtaining new access tokens)
 */
export const generateRefreshToken = (userId: string): string => {
  const signOptions: SignOptions = { expiresIn: auth.refreshTokenExpiry as any };
  return jwt.sign(
    {
      sub: userId,
      jti: uuidv4(),
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    },
    auth.jwtRefreshSecret,
    signOptions
  );
};

/**
 * Verify and decode access token
 */
export const verifyAccessToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, auth.jwtSecret) as {
      sub: string;
      email: string;
      role: string;
      type: string;
      iat: number;
      exp: number;
    };

    if (decoded.type !== 'access') {
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
export const verifyRefreshToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, auth.jwtRefreshSecret) as {
      sub: string;
      jti: string;
      type: string;
      iat: number;
      exp: number;
    };

    if (decoded.type !== 'refresh') {
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
 * Get token expiration time in seconds from now
 */
export const getTokenExpiryInSeconds = (token: string): number => {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded?.exp) return 0;
    return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
  } catch {
    return 0;
  }
};
