import type { PrismaClient } from "@prisma/client";

export interface CreateSessionRecord {
  userId: number;
  jti: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  deviceName?: string | undefined;
}

export class SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: CreateSessionRecord): Promise<void> {
    await this.prisma.refreshToken.create({
      data: this.toCreateData(record),
    });
  }

  async findByJti(jti: string) {
    return this.prisma.refreshToken.findUnique({
      where: { jti },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            emailVerified: true,
            onboardingCompleted: true,
            status: true,
            defaultWorkspaceId: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async rotateAtomically(input: {
    currentSessionId: number;
    newSession: CreateSessionRecord;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: {
          id: input.currentSessionId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          replacedByJti: input.newSession.jti,
        },
      });

      if (revoked.count !== 1) {
        return false;
      }

      await tx.refreshToken.create({
        data: this.toCreateData(input.newSession),
      });

      return true;
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async revokeExact(jti: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        jti,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private toCreateData(record: CreateSessionRecord) {
    return {
      userId: record.userId,
      jti: record.jti,
      familyId: record.familyId,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      ipAddress: record.ipAddress ?? null,
      userAgent: record.userAgent ?? null,
      deviceName: record.deviceName ?? null,
    };
  }
}
