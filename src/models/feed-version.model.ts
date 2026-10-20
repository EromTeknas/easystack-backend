import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedVersion extends Document {
  feedId: number; // References MySQL Feed ID
  versionNumber: number;
  notes: string;
  baseLanguage: string;
  baseContent: Record<string, any>; // The actual JSON payload
  selectedKeys?: string[]; // Keys to be translated
  isLocked: boolean; // True if bundled into a Release
  supportedLanguages?: string[]; // Configured languages snapshotted at version creation / lock time
  createdBy: number; // References MySQL User ID
  createdAt: Date;
  updatedAt: Date;
}

const FeedVersionSchema = new Schema(
  {
    feedId: { type: Number, required: true, index: true },
    versionNumber: { type: Number, required: true },
    notes: { type: String, default: '' },
    baseLanguage: { type: String, required: true },
    baseContent: { type: Schema.Types.Mixed, required: true, default: {} },
    selectedKeys: { type: [String], default: undefined },
    isLocked: { type: Boolean, default: false },
    supportedLanguages: { type: [String], default: undefined },
    createdBy: { type: Number, required: true },
  },
  { timestamps: true }
);

// Prevent duplicate versions for the same feed
FeedVersionSchema.index({ feedId: 1, versionNumber: 1 }, { unique: true });

export const FeedVersion = mongoose.model<IFeedVersion>('FeedVersion', FeedVersionSchema);
