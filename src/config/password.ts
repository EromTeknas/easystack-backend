import { env } from "./env";

/**
 * Password Configuration
 * Centralized password hashing and validation settings
 */

export const password = {
  // Bcrypt rounds for hashing
  bcryptRounds: env.BCRYPT_ROUNDS,
  
  // Password validation rules
  validation: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true
  },
  
  // Password validation regex patterns
  patterns: {
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /\d/,
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
  }
};

export default password;
