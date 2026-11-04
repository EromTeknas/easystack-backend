import mongoose from 'mongoose';
import { ContentAuditLog, ContentAuditAction, IContentAuditLog } from '../models/content-audit-log.model';
import { prisma } from '../db';

export interface CreateAuditLogDto {
  projectId: number;
  schemaSlug: string;
  contentEntryId: mongoose.Types.ObjectId | string;
  environment: string;
  action: ContentAuditAction;
  userId?: number | undefined;
  userName?: string | undefined;
  userEmail?: string | undefined;
  message: string;
  details?: Record<string, any> | undefined;
}

export const ContentAuditService = {
  async log(dto: CreateAuditLogDto): Promise<IContentAuditLog> {
    let userName = dto.userName;
    let userEmail = dto.userEmail;

    if (dto.userId && (!userName || !userEmail)) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: dto.userId },
          select: { firstName: true, lastName: true, email: true },
        });
        if (user) {
          userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
          userEmail = user.email;
        }
      } catch {
        // Fallback gracefully if db user lookup fails
      }
    }

    const payload: any = {
      projectId: dto.projectId,
      schemaSlug: dto.schemaSlug.toLowerCase().trim(),
      contentEntryId: new mongoose.Types.ObjectId(dto.contentEntryId),
      environment: (dto.environment || 'development').toLowerCase().trim(),
      action: dto.action,
      userName: userName || (dto.userId ? 'User' : 'AI Translation Engine'),
      userEmail: userEmail || '',
      message: dto.message,
      details: dto.details || {},
    };

    if (dto.userId !== undefined) {
      payload.userId = dto.userId;
    }

    return ContentAuditLog.create(payload);
  },

  async listLogsForEntry(
    projectId: number,
    schemaSlug: string,
    contentEntryId: string
  ): Promise<IContentAuditLog[]> {
    if (!mongoose.Types.ObjectId.isValid(contentEntryId)) {
      return [];
    }

    return ContentAuditLog.find({
      projectId,
      schemaSlug: schemaSlug.toLowerCase().trim(),
      contentEntryId: new mongoose.Types.ObjectId(contentEntryId),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
  },
};
