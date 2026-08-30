import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedReviewRequest extends Document {
  feedLocalizationId: mongoose.Types.ObjectId; // References FeedLocalization _id
  requestedUserId: number; // References MySQL User ID
  requestedByUserId: number; // References MySQL User ID who requested it
  status: 'PENDING' | 'CHANGES_REQUESTED' | 'APPROVED';
  createdAt: Date;
  updatedAt: Date;
}

const FeedReviewRequestSchema = new Schema(
  {
    feedLocalizationId: { type: Schema.Types.ObjectId, ref: 'FeedLocalization', required: true, index: true },
    requestedUserId: { type: Number, required: true },
    requestedByUserId: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CHANGES_REQUESTED', 'APPROVED'],
      default: 'PENDING',
    }
  },
  { timestamps: true }
);

// A user can only have one active review request per translation at a time
FeedReviewRequestSchema.index({ feedLocalizationId: 1, requestedUserId: 1 }, { unique: true });

export const FeedReviewRequest = mongoose.model<IFeedReviewRequest>('FeedReviewRequest', FeedReviewRequestSchema);
