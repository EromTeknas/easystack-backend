import crypto from 'crypto';
import { redisClient } from '../../db/redis';
import { prisma } from '../../db/prisma';
import { ApiKeyRepository, SafeApiKey } from '../repositories/api-key.repository';
import { DeliveryContext } from '../types/delivery.types';
import { BadRequestError, NotFoundError } from '../../errors';

export interface CreateApiKeyInput {
  projectId: number;
  environmentId: number;
  name: string;
  rateLimitPerMinute?: number | undefined;
  allowedOrigins?: string[] | null | undefined;
}

export interface CreateApiKeyResult {
  apiKey: SafeApiKey;
  rawKey: string;
}

export const ApiKeyAuthService = {
  hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  },

  async createKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
    if (!input.name || !input.name.trim()) {
      throw new BadRequestError('API key name is required');
    }

    const environment = await prisma.environment.findFirst({
      where: {
        id: input.environmentId,
        projectId: input.projectId,
      },
    });

    if (!environment) {
      throw new NotFoundError(`Environment with ID ${input.environmentId} not found in this project`);
    }

    // Determine prefix based on environment name
    const envClean = environment.name.toLowerCase().trim();
    let prefixType = 'dev';
    if (envClean === 'live' || envClean === 'production') {
      prefixType = 'live';
    } else if (envClean === 'dev' || envClean === 'development') {
      prefixType = 'dev';
    } else {
      prefixType = envClean.replace(/[^a-z0-9]/g, '');
    }

    const keyPrefixIdent = `es_${prefixType}_`;
    const secretBytes = crypto.randomBytes(32).toString('hex');
    const rawKey = `${keyPrefixIdent}${secretBytes}`;
    const keyPrefix = `${keyPrefixIdent}${secretBytes.substring(0, 8)}...`;
    const keyHash = this.hashKey(rawKey);

    const created = await ApiKeyRepository.create({
      projectId: input.projectId,
      environmentId: input.environmentId,
      name: input.name.trim(),
      keyPrefix,
      keyHash,
      rateLimitPerMinute: input.rateLimitPerMinute ?? 600,
      allowedOrigins: input.allowedOrigins ?? null,
    });

    const safeKey: SafeApiKey = {
      id: created.id,
      projectId: created.projectId,
      environmentId: created.environmentId,
      name: created.name,
      keyPrefix: created.keyPrefix,
      status: created.status,
      rateLimitPerMinute: created.rateLimitPerMinute,
      allowedOrigins: created.allowedOrigins,
      lastUsedAt: created.lastUsedAt,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      revokedAt: created.revokedAt,
      environment: {
        id: environment.id,
        name: environment.name,
        displayName: environment.displayName,
      },
    };

    return {
      apiKey: safeKey,
      rawKey,
    };
  },

  async verifyKey(rawKey: string): Promise<DeliveryContext | null> {
    if (!rawKey || typeof rawKey !== 'string') {
      return null;
    }

    const keyHash = this.hashKey(rawKey.trim());
    const cacheKey = `apikey:auth:${keyHash}`;

    // Check Redis cache first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const context: DeliveryContext = JSON.parse(cached);
        // Fire-and-forget lastUsedAt update
        ApiKeyRepository.touchLastUsed(context.apiKeyId);
        return context;
      }
    } catch {
      // In case Redis is unreachable, fallback to DB
    }

    // Lookup from database
    const apiKey = await ApiKeyRepository.findByKeyHash(keyHash);
    if (!apiKey) {
      return null;
    }

    const context: DeliveryContext = {
      projectId: apiKey.projectId,
      environmentId: apiKey.environmentId,
      environmentName: apiKey.environment.name,
      environmentDisplayName: apiKey.environment.displayName || apiKey.environment.name,
      projectName: apiKey.project.name,
      apiKeyId: apiKey.id,
      apiKeyName: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      rateLimitPerMinute: apiKey.rateLimitPerMinute,
      allowedOrigins: (apiKey.allowedOrigins as string[]) || null,
    };

    // Cache in Redis for 300 seconds (5 minutes)
    try {
      await redisClient.set(cacheKey, JSON.stringify(context), 'EX', 300);
    } catch {
      // Redis caching failure should not block delivery
    }

    // Touch lastUsedAt in MySQL
    ApiKeyRepository.touchLastUsed(apiKey.id);

    return context;
  },

  async revokeKey(id: number, projectId: number): Promise<SafeApiKey> {
    const existing = await ApiKeyRepository.findById(id, projectId);
    if (!existing) {
      throw new NotFoundError(`API key with ID ${id} not found in this project`);
    }

    const revoked = await ApiKeyRepository.revoke(id, projectId);

    // Invalidate Redis cache immediately
    try {
      await redisClient.del(`apikey:auth:${existing.keyHash}`);
    } catch {
      // Non-fatal if Redis key eviction fails
    }

    const safeKey: SafeApiKey = {
      id: revoked.id,
      projectId: revoked.projectId,
      environmentId: revoked.environmentId,
      name: revoked.name,
      keyPrefix: revoked.keyPrefix,
      status: revoked.status,
      rateLimitPerMinute: revoked.rateLimitPerMinute,
      allowedOrigins: revoked.allowedOrigins,
      lastUsedAt: revoked.lastUsedAt,
      createdAt: revoked.createdAt,
      updatedAt: revoked.updatedAt,
      revokedAt: revoked.revokedAt,
      environment: existing.environment ?? undefined,
    };

    return safeKey;
  },

  async listKeys(projectId: number, environmentId?: number): Promise<SafeApiKey[]> {
    return ApiKeyRepository.listByProject(projectId, environmentId);
  },
};
