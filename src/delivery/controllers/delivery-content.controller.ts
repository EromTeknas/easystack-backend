import { Response, NextFunction } from 'express';
import { DeliveryContentService } from '../services/delivery-content.service';
import { DeliveryConnectionTestResponse } from '../types/delivery.types';
import { BadRequestError } from '../../errors';

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

      const result = await DeliveryContentService.getBlueprintContent(
        req.deliveryContext,
        blueprintSlug,
        queryParams
      );

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

      const result = await DeliveryContentService.getCollectionEntry(
        req.deliveryContext,
        blueprintSlug,
        entrySlug,
        locale
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
