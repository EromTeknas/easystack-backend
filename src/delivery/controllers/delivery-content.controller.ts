import { Response, NextFunction } from 'express';
import { DeliveryContentService } from '../services/delivery-content.service';
import { DeliveryCacheService } from '../services/delivery-cache.service';
import { DeliveryConnectionTestResponse } from '../types/delivery.types';
import { BadRequestError } from '../../errors';

function isETagMatch(incomingHeader?: string, currentETag?: string): boolean {
  if (!incomingHeader || !currentETag) {
    return false;
  }
  const cleanIncoming = incomingHeader.trim();
  const cleanCurrent = currentETag.trim();

  if (cleanIncoming === cleanCurrent) {
    return true;
  }
  // Weak comparison: strip W/ prefix if present
  const unweakIncoming = cleanIncoming.replace(/^W\//, '');
  const unweakCurrent = cleanCurrent.replace(/^W\//, '');
  return unweakIncoming === unweakCurrent;
}

export const DeliveryContentController = {
  async testConnection(
    req: any,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const context = req.deliveryContext;
      const response: DeliveryConnectionTestResponse = {
        status: 'connected',
        project: {
          id: context.projectId,
          name: context.projectName,
        },
        environment: {
          id: context.environmentId,
          name: context.environmentName,
          displayName: context.environmentDisplayName,
        },
        key: {
          id: context.apiKeyId,
          name: context.apiKeyName,
          prefix: context.keyPrefix,
        },
        timestamp: new Date().toISOString(),
      };

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },

  async getContent(
    req: any,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const blueprintSlug = req.params.blueprintSlug as string;
      if (!blueprintSlug || typeof blueprintSlug !== 'string') {
        throw new BadRequestError('blueprintSlug parameter is required');
      }

      const queryParams = {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search as string | undefined,
        sort: req.query.sort as string | undefined,
        locale: req.query.locale as string | undefined,
        fields: req.query.fields as string | undefined,
      };

      const { projectId, environmentName } = req.deliveryContext;
      const version = await DeliveryCacheService.getBlueprintVersion(
        projectId,
        environmentName,
        blueprintSlug
      );

      const cacheKey = DeliveryCacheService.buildCacheKey(
        projectId,
        environmentName,
        blueprintSlug,
        version,
        'collection',
        'root',
        queryParams
      );

      // Check Redis cache
      const cached = await DeliveryCacheService.getCachedResponse(cacheKey);
      if (cached) {
        res.setHeader('ETag', cached.etag);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Content-Version', String(cached.version));
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');

        if (isETagMatch(req.headers['if-none-match'], cached.etag)) {
          res.status(304).end();
          return;
        }

        res.status(200).json(cached.data);
        return;
      }

      // Cache MISS: retrieve from database
      const result = await DeliveryContentService.getBlueprintContent(
        req.deliveryContext,
        blueprintSlug,
        queryParams
      );

      const etag = DeliveryCacheService.generateETag(result);

      res.setHeader('ETag', etag);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Content-Version', String(version));
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');

      // Async write to Redis cache (1 hour TTL)
      DeliveryCacheService.setCachedResponse(cacheKey, result, etag, version, 3600);

      if (isETagMatch(req.headers['if-none-match'], etag)) {
        res.status(304).end();
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getEntry(
    req: any,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const blueprintSlug = req.params.blueprintSlug as string;
      const entrySlug = req.params.entrySlug as string;

      if (!blueprintSlug || typeof blueprintSlug !== 'string') {
        throw new BadRequestError('blueprintSlug parameter is required');
      }
      if (!entrySlug || typeof entrySlug !== 'string') {
        throw new BadRequestError('entrySlug parameter is required');
      }

      const locale = req.query.locale as string | undefined;
      const { projectId, environmentName } = req.deliveryContext;

      const version = await DeliveryCacheService.getBlueprintVersion(
        projectId,
        environmentName,
        blueprintSlug
      );

      const cacheKey = DeliveryCacheService.buildCacheKey(
        projectId,
        environmentName,
        blueprintSlug,
        version,
        'entry',
        entrySlug,
        { locale }
      );

      // Check Redis cache
      const cached = await DeliveryCacheService.getCachedResponse(cacheKey);
      if (cached) {
        res.setHeader('ETag', cached.etag);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Content-Version', String(cached.version));
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');

        if (isETagMatch(req.headers['if-none-match'], cached.etag)) {
          res.status(304).end();
          return;
        }

        res.status(200).json(cached.data);
        return;
      }

      // Cache MISS: retrieve from database
      const result = await DeliveryContentService.getCollectionEntry(
        req.deliveryContext,
        blueprintSlug,
        entrySlug,
        locale
      );

      const etag = DeliveryCacheService.generateETag(result);

      res.setHeader('ETag', etag);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Content-Version', String(version));
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');

      // Async write to Redis cache (1 hour TTL)
      DeliveryCacheService.setCachedResponse(cacheKey, result, etag, version, 3600);

      if (isETagMatch(req.headers['if-none-match'], etag)) {
        res.status(304).end();
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
