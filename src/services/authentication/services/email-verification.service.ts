import { ConflictError, NotFoundError, UnauthorizedError } from "../../../errors";
import { generateOtpCode, hashOtp, verifyOtp } from "../../../utils/otp";
import type { AuthenticationNotifier } from "../adapters/authentication-notifier";
import { EmailVerificationCache } from "../cache/email-verification.cache";
import { AuthenticationRepository } from "../repositories/authentication.repository";
import type { AuthUser } from "../types/authentication.types";
import { AccountProvisioningService } from "./account-provisioning.service";

export class EmailVerificationService {
  constructor(
    private readonly cache: EmailVerificationCache,
    private readonly users: AuthenticationRepository,
    private readonly provisioning: AccountProvisioningService,
    private readonly notifier: AuthenticationNotifier,
  ) {}

  async issue(user: AuthUser, planKey = "free"): Promise<string> {
    const otpCode = generateOtpCode();
    const otpHash = await hashOtp(otpCode);
    const verificationToken = await this.cache.create({
      userId: user.id.toString(),
      email: user.email,
      otpHash,
      planKey,
    });

    await this.notifier.sendVerificationOtp({
      email: user.email,
      firstName: user.firstName ?? "",
      otpCode,
    });

    return verificationToken;
  }

  async resend(verificationToken: string): Promise<{ email: string }> {
    const record = await this.cache.get(verificationToken);

    if (!record) {
      throw new NotFoundError("Verification token not found or has expired");
    }

    const user = await this.users.findUserById(Number(record.userId));

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.emailVerified) {
      return { email: user.email };
    }

    const otpCode = generateOtpCode();
    const otpHash = await hashOtp(otpCode);
    const updated = await this.cache.replaceOtp(verificationToken, otpHash);

    if (!updated) {
      throw new NotFoundError("Verification token not found or has expired");
    }

    await this.notifier.sendVerificationOtp({
      email: user.email,
      firstName: user.firstName ?? "",
      otpCode,
    });

    return { email: user.email };
  }

  async verifyAndActivate(input: {
    verificationToken: string;
    otpCode: string;
  }) {
    const lockOwner = await this.cache.acquireLock(input.verificationToken);

    if (!lockOwner) {
      throw new ConflictError("Verification is already being processed");
    }

    try {
      const record = await this.cache.get(input.verificationToken);

      if (!record || record.purpose !== "EMAIL_VERIFICATION") {
        throw new UnauthorizedError("Invalid or expired verification token");
      }

      if (record.attempts >= record.maxAttempts) {
        throw new UnauthorizedError("Too many invalid OTP attempts");
      }

      const valid = await verifyOtp(input.otpCode, record.otpHash);

      if (!valid) {
        const updated = await this.cache.incrementAttempts(
          input.verificationToken,
        );

        throw new UnauthorizedError(
          `Invalid OTP code (${updated?.attempts ?? 1}/${updated?.maxAttempts ?? record.maxAttempts})`,
        );
      }

      const result = await this.provisioning.activateExistingUser(
        Number(record.userId),
        record.planKey,
      );

      await this.cache.delete(input.verificationToken);

      return result;
    } finally {
      await this.cache.releaseLock(input.verificationToken, lockOwner);
    }
  }
}
