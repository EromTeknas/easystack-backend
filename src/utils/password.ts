import bcrypt from 'bcrypt';
import { password as passwordConfig } from '../config/password';

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, passwordConfig.bcryptRounds);
};

/**
 * Verify a password against a hash
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Hash a token (for storing refresh tokens)
 */
export const hashToken = async (token: string): Promise<string> => {
  return bcrypt.hash(token, passwordConfig.bcryptRounds);
};

/**
 * Verify a token against a hash
 */
export const verifyTokenHash = async (token: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(token, hash);
};
