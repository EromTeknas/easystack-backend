import { createHash } from "node:crypto";

import { authenticationConfig } from "../config/authentication.config";

const PREFIX = `authentication:${authenticationConfig.cacheVersion}`;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class AuthenticationCacheKeys {
  static emailVerification(token: string): string {
    return `${PREFIX}:email-verification:${digest(token)}`;
  }

  static emailVerificationForUser(userId: string): string {
    return `${PREFIX}:email-verification-user:${userId}`;
  }

  static emailVerificationLock(token: string): string {
    return `${PREFIX}:email-verification-lock:${digest(token)}`;
  }

  static passwordReset(token: string): string {
    return `${PREFIX}:password-reset:${digest(token)}`;
  }

  static passwordResetForUser(userId: string): string {
    return `${PREFIX}:password-reset-user:${userId}`;
  }
}
