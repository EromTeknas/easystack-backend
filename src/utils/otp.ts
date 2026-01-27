/**
 * OTP (One-Time Password) Utilities
 * Handles OTP generation, hashing, and validation
 */

import { randomInt } from 'crypto';
import { hashToken, verifyTokenHash } from './password';
import { auth } from '../config/auth';

/**
 * Generate a random OTP code
 * Returns a string of digits (e.g., "123456")
 */
export function generateOtpCode(): string {
  const length = auth.otp.length;
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += randomInt(0, 10);
  }
  
  return otp;
}

/**
 * Hash an OTP code for secure storage
 */
export async function hashOtp(otpCode: string): Promise<string> {
  return hashToken(otpCode);
}

/**
 * Verify an OTP code against its hash
 */
export async function verifyOtp(otpCode: string, hash: string): Promise<boolean> {
  return verifyTokenHash(otpCode, hash);
}

/**
 * Calculate OTP expiry timestamp
 */
export function calculateOtpExpiry(): Date {
  const expiryMs = auth.otp.expiryMinutes * 60 * 1000;
  return new Date(Date.now() + expiryMs);
}

/**
 * Check if OTP has expired
 */
export function isOtpExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}
