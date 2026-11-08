import { prisma } from '../../db/prisma';
import { ApiKey, ApiKeyStatus, Prisma } from '@prisma/client';

export interface CreateApiKeyDto {
  projectId: number;
  environmentId: number;
  name: string;
  keyPrefix: string;
  keyHash: string;
  rateLimitPerMinute?: number | undefined;
  allowedOrigins?: string[] | null | undefined;
}

export type SafeApiKey = Omit<ApiKey, 'keyHash'> & {
  environment?: {
    id: number;
    name: string;
    displayName: string | null;
  } | undefined;
};

export type ApiKeyWithEnvironment = ApiKey & {
  environment?: {
    id: number;
    name: string;
    displayName: string | null;
  } | null;
};

export const ApiKeyRepository = {
  async create(data: CreateApiKeyDto): Promise<ApiKey> {
    return prisma.apiKey.create({
      data: {
        projectId: data.projectId,
        environmentId: data.environmentId,
        name: data.name,
        keyPrefix: data.keyPrefix,
        keyHash: data.keyHash,
        status: ApiKeyStatus.ACTIVE,
        rateLimitPerMinute: data.rateLimitPerMinute ?? 600,
        allowedOrigins: data.allowedOrigins ? (data.allowedOrigins as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
  },

  async findByKeyHash(keyHash: string) {
    return prisma.apiKey.findFirst({
      where: {
        keyHash,
        status: ApiKeyStatus.ACTIVE,
        revokedAt: null,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        environment: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });
  },

  async listByProject(projectId: number, environmentId?: number): Promise<SafeApiKey[]> {
    const where: Prisma.ApiKeyWhereInput = {
      projectId,
    };

    if (environmentId) {
      where.environmentId = environmentId;
    }

    return prisma.apiKey.findMany({
      where,
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        name: true,
        keyPrefix: true,
        status: true,
        rateLimitPerMinute: true,
        allowedOrigins: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        revokedAt: true,
        environment: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }) as unknown as Promise<SafeApiKey[]>;
  },

  async findById(id: number, projectId: number): Promise<ApiKeyWithEnvironment | null> {
    return prisma.apiKey.findFirst({
      where: {
        id,
        projectId,
      },
      include: {
        environment: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });
  },

  async revoke(id: number, projectId: number): Promise<ApiKey> {
    return prisma.apiKey.update({
      where: {
        id,
      },
      data: {
        status: ApiKeyStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
  },

  async touchLastUsed(id: number): Promise<void> {
    try {
      await prisma.apiKey.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      // Fire-and-forget; ignore errors during touch
    }
  },
};
