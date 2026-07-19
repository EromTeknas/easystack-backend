/**
 * Authentication Configuration
 * Centralized auth constants and settings
 */
import { env } from "./env";

const cookieSecure = env.AUTH_COOKIE_SECURE ??
  (env.NODE_ENV === "production" || env.ENVIRONMENT === "prod");
const accessTokenExpiryMinutes = env.ACCESS_TOKEN_EXPIRY_MINUTES ?? env.ACCESS_TOKEN_EXPIRY ?? 15;
const refreshTokenExpiryMinutes = env.REFRESH_TOKEN_EXPIRY_MINUTES ?? env.REFRESH_TOKEN_EXPIRY ?? 43200;

export const auth = {
  // Token expiry times (string format for jwt.sign)
  accessTokenExpiryInMinutes: accessTokenExpiryMinutes,
  refreshTokenExpiryInMinutes: refreshTokenExpiryMinutes,
  
  // Token expiry in seconds (for calculations)
  accessTokenExpirySeconds: accessTokenExpiryMinutes * 60,
  refreshTokenExpirySeconds: refreshTokenExpiryMinutes * 60,
  
  // JWT Secrets
  jwtSecret: env.JWT_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  
  // OTP Configuration
  otp: {
    length: 6,
    expiryMinutes: env.OTP_EXPIRY_MINUTES,
    maxAttempts: env.OTP_MAX_ATTEMPTS
  },
  
  // Password reset configuration
  passwordReset: {
    expiryMinutes: env.PASSWORD_RESET_EXPIRY_MINUTES
  },
  
  // Cookie settings
  cookies: {
    accessTokenName: 'accessToken',
    refreshTokenName: 'refreshToken',
    httpOnly: true,
    secure: cookieSecure,
    sameSite: env.AUTH_COOKIE_SAMESITE,
    domain: env.AUTH_COOKIE_DOMAIN,
    path: env.AUTH_COOKIE_PATH,
  },
  
  // Rate limiting
  rateLimiting: {
    authWindowMs: 15 * 60 * 1000, // 15 minutes
    authMaxRequests: 5, // Max 5 auth requests per window
    otpWindowMs: 5 * 60 * 1000, // 5 minutes
    otpMaxRequests: 3 // Max 3 OTP requests per window
  }
};

export default auth;
