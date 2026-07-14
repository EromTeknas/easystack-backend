import {
  AuthProvider,
  Prisma,
  PrismaClient,
  UserStatus,
} from "@prisma/client";

import { ConflictError } from "../../../errors";
import { AUTH_ERROR_CODES } from "../../../constants/errorCodes";
import type { AuthUser } from "../types/authentication.types";
import type { VerifiedProviderIdentity } from "../types/provider.types";

const authUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  emailVerified: true,
  onboardingCompleted: true,
  status: true,
  defaultWorkspaceId: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export class AuthenticationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async registerPendingPasswordAccount(input: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
  }): Promise<AuthUser> {
    return this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: input.email },
        select: {
          id: true,
          emailVerified: true,
          status: true,
        },
      });

      if (existingUser?.emailVerified || existingUser?.status === UserStatus.ACTIVE) {
        throw new ConflictError(
          "Email already registered. Please log in.",
          AUTH_ERROR_CODES.EMAIL_ALREADY_VERIFIED,
          { field: "email" },
        );
      }

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              firstName: input.firstName,
              lastName: input.lastName,
              status: UserStatus.PENDING_VERIFICATION,
              deletedAt: null,
            },
            select: authUserSelect,
          })
        : await tx.user.create({
            data: {
              email: input.email,
              firstName: input.firstName,
              lastName: input.lastName,
              emailVerified: false,
              status: UserStatus.PENDING_VERIFICATION,
            },
            select: authUserSelect,
          });

      await tx.authAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: AuthProvider.PASSWORD,
            providerAccountId: input.email,
          },
        },
        update: {
          userId: user.id,
          email: input.email,
          emailVerified: false,
          passwordHash: input.passwordHash,
        },
        create: {
          userId: user.id,
          provider: AuthProvider.PASSWORD,
          providerAccountId: input.email,
          email: input.email,
          emailVerified: false,
          passwordHash: input.passwordHash,
        },
      });

      return user;
    });
  }

  async findPasswordLoginByEmail(email: string) {
    return this.prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.PASSWORD,
          providerAccountId: email,
        },
      },
      select: {
        id: true,
        passwordHash: true,
        user: {
          select: authUserSelect,
        },
      },
    });
  }

  async findUserById(userId: number): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: authUserSelect,
    });
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: authUserSelect,
    });
  }

  async findProviderAccount(provider: AuthProvider, providerAccountId: string) {
    return this.prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: authUserSelect,
        },
      },
    });
  }


  async linkProviderAccount(
    userId: number,
    identity: VerifiedProviderIdentity,
  ): Promise<void> {
    await this.prisma.authAccount.create({
      data: {
        userId,
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
        email: identity.email,
        emailVerified: identity.emailVerified,
        ...(identity.metadata
          ? { metadata: identity.metadata as Prisma.InputJsonValue }
          : {}),
        lastUsedAt: new Date(),
      },
    });
  }

  async recordSuccessfulLogin(userId: number, accountId?: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      });

      if (accountId) {
        await tx.authAccount.update({
          where: { id: accountId },
          data: { lastUsedAt: new Date() },
        });
      }
    });
  }

  async setPasswordAndRevokeSessions(input: {
    userId: number;
    email: string;
    passwordHash: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.authAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: AuthProvider.PASSWORD,
            providerAccountId: input.email,
          },
        },
        update: {
          userId: input.userId,
          email: input.email,
          emailVerified: true,
          passwordHash: input.passwordHash,
        },
        create: {
          userId: input.userId,
          provider: AuthProvider.PASSWORD,
          providerAccountId: input.email,
          email: input.email,
          emailVerified: true,
          passwordHash: input.passwordHash,
        },
      });

      await tx.refreshToken.updateMany({
        where: {
          userId: input.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    });
  }
}
