import mongoose, { Schema, Document } from 'mongoose';

export interface IProjectLanguageAuditLog extends Document {
  projectId: number;
  userId: number;
  action: 'LANGUAGE_ADDED' | 'LANGUAGE_REMOVED';
  languageCode: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectLanguageAuditLogSchema = new Schema(
  {
    projectId: { type: Number, required: true, index: true },
    userId: { type: Number, required: true },
    action: {
      type: String,
      enum: ['LANGUAGE_ADDED', 'LANGUAGE_REMOVED'],
      required: true,
    },
    languageCode: { type: String, required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

ProjectLanguageAuditLogSchema.index({ projectId: 1, createdAt: -1 });

export const ProjectLanguageAuditLog = mongoose.model<IProjectLanguageAuditLog>(
  'ProjectLanguageAuditLog',
  ProjectLanguageAuditLogSchema
);
