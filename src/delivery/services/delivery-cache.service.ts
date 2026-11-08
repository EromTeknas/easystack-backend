import crypto from 'crypto';
import { redisClient } from '../../db/redis';

export interface CachedDeliveryPayload {
  data: any;
  etag: string;
  version: number;
}

export const DeliveryCacheService = {
  canonicalEnv(envName: string): string {
    const clean = envName.toLowerCase().trim();
    if (clean === 'production' || clean === 'live') {
      return 'live';
    }
    if (clean === 'development' || clean === 'dev') {
      return 'dev';
    }
    return clean;
  },

  getVersionKey(projectId: number, envName: string, blueprintSlug: string): string {
    return `cdn:version:${projectId}:${this.canonicalEnv(envName)}:${blueprintSlug.toLowerCase().trim()}`;
  },

  async getBlueprintVersion(projectId: number, envName: string, blueprintSlug: string): Promise<number> {
    try {
      const key = this.getVersionKey(projectId, envName, blueprintSlug);
      const val = await redisClient.get(key);
      if (!val) {
        return 1;
      }
      const parsed = parseInt(val, 10);
      return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
    } catch {
      return 1;
    }
  },

  async incrementBlueprintVersion(projectId: number, envName: string, blueprintSlug: string): Promise<number> {
    try {
      const key = this.getVersionKey(projectId, envName, blueprintSlug);
      const nextVer = await redisClient.incr(key);
      if (nextVer === 1) {
        // Baseline version without explicit Redis key is 1; therefore the first increment moves to 2
        return await redisClient.incr(key);
      }
      return nextVer;
    } catch {
      return 1;
    }
  },

  generateETag(payload: any): string {
    const hash = crypto.createHash('md5').update(JSON.stringify(payload)).digest('hex');
    return `W/"${hash}"`;
  },

  buildCacheKey(
    projectId: number,
    envName: string,
    blueprintSlug: string,
    version: number,
    scope: 'singleton' | 'collection' | 'entry',
    identifier: string,
    queryParams: Record<string, any> = {}
  ): string {
    const sortedKeys = Object.keys(queryParams).sort();
    const cleanParams: Record<string, any> = {};
    for (const k of sortedKeys) {
      if (queryParams[k] !== undefined && queryParams[k] !== '') {
        cleanParams[k] = queryParams[k];
      }
    }

    const queryHash =
      Object.keys(cleanParams).length > 0
        ? crypto.createHash('md5').update(JSON.stringify(cleanParams)).digest('hex').substring(0, 16)
        : 'default';

    const cleanLocale =
      queryParams.locale && typeof queryParams.locale === 'string'
        ? queryParams.locale.toLowerCase().trim()
        : 'default';

    const cleanIdentifier = identifier.toLowerCase().trim();

    return `cdn:cache:${projectId}:${this.canonicalEnv(envName)}:${blueprintSlug.toLowerCase().trim()}:v${version}:${scope}:${cleanIdentifier}:${cleanLocale}:${queryHash}`;
  },

  async getCachedResponse(cacheKey: string): Promise<CachedDeliveryPayload | null> {
    try {
      const raw = await redisClient.get(cacheKey);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as CachedDeliveryPayload;
    } catch {
      return null;
    }
  },

  async setCachedResponse(
    cacheKey: string,
    payload: any,
    etag: string,
    version: number,
    ttlSeconds: number = 3600
  ): Promise<void> {
    try {
      const entry: CachedDeliveryPayload = {
        data: payload,
        etag,
        version,
      };
      await redisClient.set(cacheKey, JSON.stringify(entry), 'EX', ttlSeconds);
    } catch {
      // Non-fatal if Redis write fails
    }
  },
};
