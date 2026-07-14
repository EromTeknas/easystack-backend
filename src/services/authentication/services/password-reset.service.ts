import { ConflictError, NotFoundError, UnauthorizedError } from "../../../errors";
import logger from "../../../utils/logger";
import { hashPassword } from "../../../utils/password";
import type { AuthenticationNotifier } from "../adapters/authentication-notifier";
import { PasswordResetCache } from "../cache/password-reset.cache";
import { AuthenticationRepository } from "../repositories/authentication.repository";

export class PasswordResetService {
  constructor(
    private readonly cache: PasswordResetCache,
    private readonly users: AuthenticationRepository,
    private readonly notifier: AuthenticationNotifier,
  ) {}

  async issueForVerifiedUser(input: {
    userId: number;
    email: string;
    firstName: string | null;
  }): Promise<void> {
    logger.debug("Creating password reset token", {
      userId: input.userId,
      email: input.email,
    });

    const token = await this.cache.create(input.userId.toString());

    logger.debug("Password reset token created; enqueueing email", {
      userId: input.userId,
      email: input.email,
    });

    await this.notifier.sendPasswordReset({
      email: input.email,
      firstName: input.firstName ?? "",
      token,
    });

    logger.debug("Password reset email enqueue completed", {
      userId: input.userId,
      email: input.email,
    });
  }

  async reset(input: { token: string; password: string }): Promise<void> {
    const lockOwner = await this.cache.acquireLock(input.token);

    if (!lockOwner) {
      throw new ConflictError("Password reset is already being processed");
    }

    try {
      const record = await this.cache.get(input.token);

      if (!record) {
        throw new UnauthorizedError("Invalid or expired reset token");
      }

      const user = await this.users.findUserById(Number(record.userId));

      if (!user) {
        throw new NotFoundError("Invalid or expired reset token");
      }

      if (!user.emailVerified) {
        throw new UnauthorizedError(
          "Email must be verified before resetting the password",
        );
      }

      const passwordHash = await hashPassword(input.password);

      await this.users.setPasswordAndRevokeSessions({
        userId: user.id,
        email: user.email,
        passwordHash,
      });

      await this.cache.delete(input.token);
    } finally {
      await this.cache.releaseLock(input.token, lockOwner);
    }
  }
}
