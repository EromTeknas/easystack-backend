import mongoose, { Schema, Document } from 'mongoose';

export type ContentAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'PUBLISHED'
  | 'SCHEDULED'
  | 'AI_TRANSLATED'
  | 'AI_TRANSLATION_TRIGGERED'
  | 'TRANSLATION_OVERRIDDEN'
  | 'SYNCED'
  | 'DRAFT_DISCARDED'
  | 'DELETED';

export interface IContentAuditLog extends Document {
  projectId: number;
  schemaSlug: string;
  contentEntryId: mongoose.Types.ObjectId;
  environment: string;
  action: ContentAuditAction;
  userId?: number | null | undefined;
  userName?: string | null | undefined;
  userEmail?: string | null | undefined;
  message: string;
  details?: Record<string, any> | undefined;
  createdAt: Date;
  updatedAt: Date;
}

const ContentAuditLogSchema = new Schema(
  {
    projectId: { type: Number, required: true, index: true },
    schemaSlug: { type: String, required: true, index: true },
    contentEntryId: { type: Schema.Types.ObjectId, required: true, index: true },
    environment: { type: String, default: 'development', index: true },
    action: {
      type: String,
      enum: [
        'CREATED',
        'UPDATED',
        'PUBLISHED',
        'SCHEDULED',
        'AI_TRANSLATED',
        'AI_TRANSLATION_TRIGGERED',
        'TRANSLATION_OVERRIDDEN',
        'SYNCED',
        'DRAFT_DISCARDED',
        'DELETED',
      ],
      required: true,
    },
    userId: { type: Number },
    userName: { type: String },
    userEmail: { type: String },
    message: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ContentAuditLogSchema.index({ projectId: 1, contentEntryId: 1, createdAt: -1 });

export const ContentAuditLog = mongoose.model<IContentAuditLog>(
  'ContentAuditLog',
  ContentAuditLogSchema
);
