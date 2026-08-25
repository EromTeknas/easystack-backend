import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedLocalization extends Document {
  feedVersionId: mongoose.Types.ObjectId; // References MongoDB FeedVersion _id
  languageCode: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  localizedContent: Record<string, any>;
  attempts: number;
  startedAt?: Date;
  completedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedLocalizationSchema = new Schema(
  {
    feedVersionId: { type: Schema.Types.ObjectId, ref: 'FeedVersion', required: true, index: true },
    languageCode: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
    },
    localizedContent: { type: Schema.Types.Mixed, required: true, default: {} },
    attempts: { type: Number, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true }
);

// A specific version can only have one localization per language
FeedLocalizationSchema.index({ feedVersionId: 1, languageCode: 1 }, { unique: true });

export const FeedLocalization = mongoose.model<IFeedLocalization>('FeedLocalization', FeedLocalizationSchema);
