/**
 * Authentication Configuration
 * Centralized auth constants and settings
 */

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '30d';
const PASSWORD_RESET_EXPIRY_MINUTES = parseInt(process.env.PASSWORD_RESET_EXPIRY_MINUTES || '30', 10);

export const auth = {
  // Token expiry times (string format for jwt.sign)
  accessTokenExpiry: ACCESS_TOKEN_EXPIRY as string,
  refreshTokenExpiry: REFRESH_TOKEN_EXPIRY as string,
  
  // Token expiry in seconds (for calculations)
  accessTokenExpirySeconds: 15 * 60, // 15 minutes
  refreshTokenExpirySeconds: 30 * 24 * 60 * 60, // 30 days
  
  // JWT Secrets
  jwtSecret: JWT_SECRET as string,
  jwtRefreshSecret: JWT_REFRESH_SECRET as string,
  
  // Password hashing
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  
  // OTP Configuration
  otp: {
    length: 6,
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10)
  },
  
  // Password reset configuration
  passwordReset: {
    expiryMinutes: PASSWORD_RESET_EXPIRY_MINUTES
  },
  
  // Cookie settings
  cookies: {
    refreshTokenName: 'refreshToken',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
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
