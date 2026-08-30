import { AuthProvider, Prisma, UserStatus } from "@prisma/client";

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from "../../errors";
import { AUTH_ERROR_CODES } from "../../constants/errorCodes";
import { hashPassword, verifyPassword } from "../../utils/password";
import logger from "../../utils/logger";
import type { AuthenticationNotifier } from "./adapters/authentication-notifier";
import { AuthenticationRepository } from "./repositories/authentication.repository";
import type {
  AuthenticatedSession,
  ClientContext,
  LoginPasswordInput,
  LogoutInput,
  PublicAuthUser,
  RegisterPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UnlinkProviderInput,
  VerifyEmailInput,
} from "./types/authentication.types";
import { AuthenticationProviderRegistry } from "./providers/provider.registry";
import { AccountProvisioningService } from "./services/account-provisioning.service";
import { AuthenticationValidationService } from "./services/authentication-validation.service";
import { EmailVerificationService } from "./services/email-verification.service";
import { PasswordResetService } from "./services/password-reset.service";
import { SessionService } from "./services/session.service";

export class AuthenticationService {
  constructor(
    private readonly users: AuthenticationRepository,
    private readonly providers: AuthenticationProviderRegistry,
    private readonly provisioning: AccountProvisioningService,
    private readonly verification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
    private readonly sessions: SessionService,
    private readonly validation: AuthenticationValidationService,
    private readonly notifier: AuthenticationNotifier,
  ) {}

  async register(input: RegisterPasswordInput) {
    const validated = this.validation.validateRegistration(input);
    const passwordHash = await hashPassword(validated.password);

    const user = await this.users.registerPendingPasswordAccount({
      email: validated.email,
      firstName: validated.firstName,
      lastName: validated.lastName,
      passwordHash,
    });

    const verificationToken = await this.verification.issue(
      user,
      validated.planKey,
    );

    return {
      email: user.email,
      verificationToken,
      message: "Registration successful. Verify your email to continue.",
    };
  }

  async verifyEmail(
    input: VerifyEmailInput,
    context: ClientContext,
  ): Promise<AuthenticatedSession> {
    const validated = this.validation.validateEmailVerification(input);
    const result = await this.verification.verifyAndActivate(validated);

    await this.users.recordSuccessfulLogin(result.user.id);

    await this.notifier
      .sendWelcome({
        email: result.user.email,
        firstName: result.user.firstName ?? "",
      })
      .catch((error: any) =>
        logger.error("Failed to enqueue welcome email", {
          userId: result.user.id,
          error: error?.message,
        }),
      );

    return this.sessions.create(result.user, context);
  }

  async resendEmailVerification(verificationToken: string) {
    if (!verificationToken) {
      throw new BadRequestError("verificationToken is required");
    }

    const result = await this.verification.resend(verificationToken);

    return {
      message: "OTP sent to your email",
      email: result.email,
    };
  }

  async loginWithPassword(
    input: LoginPasswordInput,
    context: ClientContext,
  ): Promise<AuthenticatedSession> {
    const validated = this.validation.validatePasswordLogin(input);
    const login = await this.users.findPasswordLoginByEmail(validated.email);

    if (!login?.passwordHash) {
      throw new UnauthorizedError(
        "Invalid email or password",
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      );
    }

    const user = login.user;

    if (!user.emailVerified) {
      throw new UnauthorizedError(
        "Email not verified. Please verify your email to continue.",
        AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
        {
          userId: user.id,
          nextStep: "verify-email",
          canResendOtp: true,
        },
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError(
        "Invalid email or password",
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      );
    }

    const validPassword = await verifyPassword(
      validated.password,
      login.passwordHash,
    );

    if (!validPassword) {
      throw new UnauthorizedError(
        "Invalid email or password",
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      );
    }

    await this.users.recordSuccessfulLogin(user.id, login.id);
    return this.sessions.create(user, context);
  }

  async loginWithGoogle(
    credential: string,
    context: ClientContext,
  ): Promise<AuthenticatedSession> {
    if (!credential) {
      throw new BadRequestError("Google credential is required");
    }

    const provider = this.providers.get(AuthProvider.GOOGLE);
    const identity = await provider.verifyCredential({ credential });

    let providerAccount = await this.users.findProviderAccount(
      identity.provider,
      identity.providerAccountId,
    );

    if (providerAccount) {
      if (providerAccount.user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedError("User account is inactive");
      }

      const user = providerAccount.user.defaultWorkspaceId
        ? providerAccount.user
        : (
            await this.provisioning.activateExistingUser(
              providerAccount.user.id,
              "free",
            )
          ).user;

      await this.users.recordSuccessfulLogin(user.id, providerAccount.id);

      return this.sessions.create(user, context);
    }

    const existingUser = await this.users.findUserByEmail(identity.email);

    if (existingUser) {
      throw new ConflictError(
        existingUser.emailVerified
          ? "An account with this email already exists. Sign in first, then link Google from account settings."
          : "An unverified account with this email already exists. Verify that account before linking Google.",
      );
    }

    let provisioned;

    try {
      provisioned = await this.provisioning.createExternalUser({
        identity,
        planKey: "free",
      });
    } catch (error) {
      // Two identical provider callbacks can race. The unique provider/account
      // constraint is the source of truth; refetch the winner.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        providerAccount = await this.users.findProviderAccount(
          identity.provider,
          identity.providerAccountId,
        );

        if (!providerAccount) {
          throw error;
        }

        provisioned = {
          user: providerAccount.user,
          workspaceId: providerAccount.user.defaultWorkspaceId,
        };
      } else {
        throw error;
      }
    }

    await this.users.recordSuccessfulLogin(provisioned.user.id);
    return this.sessions.create(provisioned.user, context);
  }

  async linkGoogle(userId: string, credential: string) {
    if (!credential) {
      throw new BadRequestError("Google credential is required");
    }

    const user = await this.users.findUserById(Number(userId));

    if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerified) {
      throw new UnauthorizedError("User account is not active");
    }

    const provider = this.providers.get(AuthProvider.GOOGLE);
    const identity = await provider.verifyCredential({ credential });

    if (identity.email !== user.email) {
      throw new BadRequestError(
        "Google account email must match the signed-in EasyStack account",
      );
    }

    const existingProviderAccount = await this.users.findProviderAccount(
      identity.provider,
      identity.providerAccountId,
    );

    if (existingProviderAccount) {
      if (existingProviderAccount.userId !== user.id) {
        throw new ConflictError(
          "This Google account is already linked to another EasyStack account",
        );
      }

      return { message: "Google account is already linked" };
    }

    try {
      await this.users.linkProviderAccount(user.id, identity);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError(
          "A Google account is already linked to this EasyStack account",
        );
      }

      throw error;
    }

    return { message: "Google account linked successfully" };
  }

  async refresh(
    refreshToken: string | undefined,
    context: ClientContext,
  ): Promise<AuthenticatedSession> {
    if (!refreshToken) {
      throw new UnauthorizedError("Refresh token not found", AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED);
    }

    return this.sessions.rotate(refreshToken, context);
  }

  async logout(input: LogoutInput): Promise<void> {
    await this.sessions.logout({
      refreshToken: input.refreshToken,
      logoutFromAllDevices: input.logoutFromAllDevices ?? true,
    });
  }

  async requestPasswordReset(emailInput: string | undefined) {
    const email = this.validation.normalizeEmail(emailInput);
    const genericMessage =
      "If an account exists with this email, password reset instructions have been sent.";

    logger.info("POST /auth/forgot-password service start", { email });

    const user = await this.users.findUserByEmail(email);

    if (!user) {
      logger.warn("POST /auth/forgot-password user not found", { email });
      throw new NotFoundError("No account exists with this email", {
        field: "email",
      });
    }

    if (!user.emailVerified) {
      logger.info("POST /auth/forgot-password user is not verified", {
        userId: user.id,
        email,
      });

      const verificationToken = await this.verification.issue(user);

      logger.info("POST /auth/forgot-password verification OTP enqueued", {
        userId: user.id,
        email,
      });

      return {
        message: "Verify your email before resetting your password.",
        requiresEmailVerification: true,
        nextStep: "verify-email",
        verificationToken,
      };
    }

    logger.info("POST /auth/forgot-password issuing password reset", {
      userId: user.id,
      email,
    });

    await this.passwordReset.issueForVerifiedUser({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
    });

    logger.info("POST /auth/forgot-password password reset enqueued", {
      userId: user.id,
      email,
    });

    return { message: genericMessage };
  }

  async resetPassword(input: ResetPasswordInput) {
    const validated = this.validation.validatePasswordReset(input);

    await this.passwordReset.reset({
      token: validated.token,
      password: validated.password,
    });

    return {
      message:
        "Password has been reset successfully. Log in with your new password.",
    };
  }

  verifyAccessToken(accessToken: string | undefined) {
    if (!accessToken) {
      throw new UnauthorizedError("No token provided");
    }

    return this.sessions.verifyAccessToken(accessToken);
  }

  async getCurrentUser(userId: string): Promise<PublicAuthUser> {
    const user = await this.users.findUserById(Number(userId));

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    return {
      id: user.id.toString(),
      resourceId: user.resourceId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      onboardingCompleted: user.onboardingCompleted,
      status: user.status,
      createdAt: user.createdAt,
      defaultWorkspaceId: user.defaultWorkspaceId,
    };
  }

  async addPasswordMethod(userId: string, password: string): Promise<{ message: string }> {
    const numericUserId = Number(userId);
    const user = await this.users.findUserById(numericUserId);
    
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const existingPasswordAccount = await this.users.findPasswordLoginByEmail(user.email);
    if (existingPasswordAccount) {
      throw new ConflictError("A password login method is already configured for this account");
    }

    const passwordHash = await hashPassword(password);
    await this.users.addPasswordMethod(numericUserId, user.email, passwordHash);

    return { message: "Password login method added successfully" };
  }

  async getLinkedAuthProviders(userId: string) {
    const accounts = await this.users.findAuthAccountsByUserId(Number(userId));

    const googleAccount = accounts.find(
      (account) => account.provider === AuthProvider.GOOGLE,
    );
    const passwordAccount = accounts.find(
      (account) => account.provider === AuthProvider.PASSWORD,
    );

    const toProviderPayload = (
      provider: "google" | "password",
      account?: (typeof accounts)[number],
    ) => ({
      provider,
      connected: Boolean(account),
      identifier: account?.email,
      connectedAt: (account?.lastUsedAt ?? account?.createdAt)?.toISOString(),
    });

    return {
      providers: [
        toProviderPayload("google", googleAccount),
        toProviderPayload("password", passwordAccount),
      ],
    };
  }

  async unlinkAuthProvider(
    userId: string,
    providerParam: string,
    input: UnlinkProviderInput = {},
  ) {
    const provider = this.parseAuthProviderParam(providerParam);
    const numericUserId = Number(userId);
    const user = await this.users.findUserById(numericUserId);

    if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerified) {
      throw new UnauthorizedError("User account is not active");
    }

    const accounts = await this.users.findAuthAccountsByUserId(numericUserId);
    const linkedAccount = accounts.find((account) => account.provider === provider);

    if (!linkedAccount) {
      throw new NotFoundError("This sign-in method is not linked to your account");
    }

    if (accounts.length <= 1) {
      throw new BadRequestError(
        "You must keep at least one sign-in method on your account",
      );
    }

    if (provider === AuthProvider.GOOGLE) {
      if (!input.currentPassword) {
        throw new BadRequestError(
          "Current password is required to disconnect Google",
          { field: "currentPassword" },
        );
      }

      await this.verifyCurrentPasswordForUser(
        numericUserId,
        user.email,
        input.currentPassword,
      );
    } else {
      if (!input.credential) {
        throw new BadRequestError(
          "Google verification is required to remove password sign-in",
          { field: "credential" },
        );
      }

      await this.verifyGoogleReauthForUser(user, input.credential);
    }

    await this.users.deleteAuthAccountByUserAndProvider(numericUserId, provider);

    const providerLabel = provider === AuthProvider.GOOGLE ? "Google" : "Email & Password";

    return {
      message: `${providerLabel} sign-in method removed successfully`,
    };
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    currentRefreshToken?: string,
  ) {
    const validated = this.validation.validateChangePassword(input);
    const numericUserId = Number(userId);
    const user = await this.users.findUserById(numericUserId);

    if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerified) {
      throw new UnauthorizedError("User account is not active");
    }

    await this.verifyCurrentPasswordForUser(
      numericUserId,
      user.email,
      validated.currentPassword,
    );

    const passwordHash = await hashPassword(validated.password);
    await this.users.updatePasswordHashForUser(
      numericUserId,
      user.email,
      passwordHash,
    );

    const revokedCount =
      await this.sessions.revokeOtherSessionsAfterPasswordChange(
        numericUserId,
        currentRefreshToken,
      );

    return {
      message: "Password changed successfully",
      revokedOtherSessions: revokedCount >= 0 ? revokedCount : undefined,
    };
  }

  async listSessions(userId: string, currentRefreshToken?: string) {
    const sessions = await this.sessions.listActiveSessions(
      Number(userId),
      currentRefreshToken,
    );

    return { sessions };
  }

  async revokeSession(
    userId: string,
    sessionId: number,
    currentRefreshToken?: string,
  ) {
    return this.sessions.revokeSessionForUser(
      Number(userId),
      sessionId,
      currentRefreshToken,
    );
  }

  async revokeOtherSessions(userId: string, currentRefreshToken?: string) {
    return this.sessions.revokeOtherSessions(
      Number(userId),
      currentRefreshToken,
    );
  }

  private async verifyCurrentPasswordForUser(
    userId: number,
    email: string,
    currentPassword: string,
  ): Promise<void> {
    const passwordAccount = await this.users.findPasswordLoginByEmail(email);

    if (!passwordAccount?.passwordHash || passwordAccount.user.id !== userId) {
      throw new BadRequestError(
        "Password sign-in is not configured for this account",
      );
    }

    const validCurrentPassword = await verifyPassword(
      currentPassword,
      passwordAccount.passwordHash,
    );

    if (!validCurrentPassword) {
      throw new UnauthorizedError(
        "Current password is incorrect",
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        { field: "currentPassword" },
      );
    }
  }

  private async verifyGoogleReauthForUser(
    user: { id: number; email: string },
    credential: string,
  ): Promise<void> {
    const googleProvider = this.providers.get(AuthProvider.GOOGLE);
    const identity = await googleProvider.verifyCredential({ credential });

    if (identity.email !== user.email) {
      throw new BadRequestError(
        "Google account email must match the signed-in EasyStack account",
      );
    }

    const linkedGoogleAccount = await this.users.findProviderAccount(
      AuthProvider.GOOGLE,
      identity.providerAccountId,
    );

    if (!linkedGoogleAccount || linkedGoogleAccount.userId !== user.id) {
      throw new UnauthorizedError(
        "Google verification does not match the Google account linked to this user",
      );
    }
  }

  private parseAuthProviderParam(providerParam: string): AuthProvider {
    const normalized = providerParam?.trim().toLowerCase();

    if (normalized === "google") {
      return AuthProvider.GOOGLE;
    }

    if (normalized === "password") {
      return AuthProvider.PASSWORD;
    }

    throw new BadRequestError(
      "Invalid provider. Supported values: google, password",
      { field: "provider" },
    );
  }
}
