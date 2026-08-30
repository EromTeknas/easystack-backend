import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedAuditLog extends Document {
  feedId: number;
  feedVersionId: mongoose.Types.ObjectId;
  userId: number;
  action: 'CREATED_VERSION' | 'UPDATED_BASE' | 'UPDATED_TRANSLATION' | 'GENERATED_TRANSLATION' | 'REQUESTED_REVIEW' | 'APPROVED_TRANSLATION' | 'REQUESTED_CHANGES' | 'ADDED_COMMENT' | 'RESOLVED_COMMENT';
  languageCode?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedAuditLogSchema = new Schema(
  {
    feedId: { type: Number, required: true, index: true },
    feedVersionId: { type: Schema.Types.ObjectId, ref: 'FeedVersion', required: true, index: true },
    userId: { type: Number, required: true },
    action: {
      type: String,
      enum: ['CREATED_VERSION', 'UPDATED_BASE', 'UPDATED_TRANSLATION', 'GENERATED_TRANSLATION', 'REQUESTED_REVIEW', 'APPROVED_TRANSLATION', 'REQUESTED_CHANGES', 'ADDED_COMMENT', 'RESOLVED_COMMENT'],
      required: true
    },
    languageCode: { type: String },
    notes: { type: String }
  },
  { timestamps: true }
);

export const FeedAuditLog = mongoose.model<IFeedAuditLog>('FeedAuditLog', FeedAuditLogSchema);
