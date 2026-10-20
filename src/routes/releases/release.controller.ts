import { Request, Response, NextFunction } from 'express';
import { ReleaseService } from '../../services/release.service';

import { prisma } from '../../db';
import { ForbiddenError, BadRequestError } from '../../errors';


export const ReleaseController = {
  
  async getEnvironmentDiff(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const sourceEnvId = parseInt(req.query.sourceEnvironmentId as string);
      const targetEnvId = parseInt(req.query.targetEnvironmentId as string);

      if (!sourceEnvId || !targetEnvId) throw new Error('Missing source or target environment ID');

      const diff = await ReleaseService.getEnvironmentDiff(projectId, sourceEnvId, targetEnvId);
      res.json({ success: true, data: diff });
    } catch (error) {
      next(error);
    }
  },

  async suggestVersion(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const targetEnvId = parseInt(req.query.targetEnvironmentId as string);
      let feedIds = (req.query.feedIds as string)?.split(',').map(Number) || [];

      if (!targetEnvId) throw new Error('Missing target environment ID');

      const version = await ReleaseService.suggestNextVersion(projectId, targetEnvId, feedIds);
      res.json({ success: true, data: { version } });
    } catch (error) {
      next(error);
    }
  },

  async createRelease(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const userId = req.user!.id;
      const { approverIds } = req.body;
      const { name, description, sourceEnvironmentId, targetEnvironmentId, version, feedIds } = req.body;

      

      const release = await ReleaseService.createRelease(projectId, userId, {
        name, description, sourceEnvironmentId, targetEnvironmentId, version, feedIds
      });

      res.status(201).json({ success: true, data: release });
    } catch (error) {
      next(error);
    }
  },

  async listReleases(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const userId = req.user!.id;
      const { sourceEnvironmentId } = req.query;

      

      const releases = await prisma.release.findMany({
        where: {
          projectId,
          ...(sourceEnvironmentId ? { sourceEnvironmentId: parseInt(sourceEnvironmentId as string) } : {})
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          sourceEnvironment: true,
          targetEnvironment: true,
          approvals: true
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, data: releases });
    } catch (error) {
      next(error);
    }
  },

  async getRelease(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const releaseId = parseInt(req.params.releaseId as string);
      const userId = req.user!.id;

      

      const details = await ReleaseService.getReleaseDetails(releaseId, projectId);

      res.json({ success: true, data: details });
    } catch (error) {
      next(error);
    }
  },

  async approveRelease(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const releaseId = parseInt(req.params.releaseId as string);
      const userId = req.user!.id;
      const { notes } = req.body;

      

      const result = await ReleaseService.approveRelease(releaseId, projectId, userId, notes);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async requestApproval(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const releaseId = parseInt(req.params.releaseId as string);
      const userId = req.user!.id;
      const { approverIds } = req.body;
      
      if (!approverIds || !Array.isArray(approverIds) || approverIds.length === 0) {
        throw new ForbiddenError('Approver IDs are required to request approval.');
      }

      const result = await ReleaseService.requestApproval(releaseId, projectId, userId, approverIds);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async rollbackRelease(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const releaseId = parseInt(req.params.releaseId as string);
      const userId = req.user!.id;

      

      const result = await ReleaseService.rollbackRelease(releaseId, projectId, userId);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async executeRelease(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const releaseId = parseInt(req.params.releaseId as string);
      const userId = req.user!.id;

      const result = await ReleaseService.executeRelease(releaseId, projectId, userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async scheduleRelease(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const releaseId = parseInt(req.params.releaseId as string);
      const userId = req.user!.id;
      const { scheduledAt } = req.body;

      if (!scheduledAt) {
        throw new BadRequestError('Scheduled date and time is required');
      }

      const result = await ReleaseService.scheduleRelease(releaseId, projectId, userId, scheduledAt);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async cancelSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const releaseId = parseInt(req.params.releaseId as string);
      const userId = req.user!.id;

      const result = await ReleaseService.cancelSchedule(releaseId, projectId, userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async deleteRelease(req: Request, res: Response, next: NextFunction) {
    try {
      const projectId = parseInt(req.params.projectId as string);
      const releaseId = parseInt(req.params.releaseId as string);
      const userId = req.user!.id;

      await ReleaseService.deleteRelease(releaseId, projectId, userId);
      res.json({ success: true, message: 'Release deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
};

