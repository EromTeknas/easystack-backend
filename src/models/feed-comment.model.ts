import mongoose, { Schema, Document } from 'mongoose';

export interface IFeedComment extends Document {
  workspaceId: number;
  projectId: number;
  feedLocalizationId: mongoose.Types.ObjectId;
  
  authorId: number;
  parentId?: mongoose.Types.ObjectId | null;
  jsonPath?: string;
  
  content: any; // Tiptap JSON
  mentions: number[];
  
  status: 'ACTIVE' | 'DELETED';
  edited: boolean;
  
  deletedAt?: Date;
  deletedBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

const FeedCommentSchema = new Schema(
  {
    workspaceId: { type: Number, required: true },
    projectId: { type: Number, required: true },
    feedLocalizationId: { type: Schema.Types.ObjectId, ref: 'FeedLocalization', required: true },
    authorId: { type: Number, required: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'FeedComment', default: null },
    jsonPath: { type: String },
    content: { type: Schema.Types.Mixed, required: true },
    mentions: [{ type: Number }],
    status: { type: String, enum: ['ACTIVE', 'DELETED'], default: 'ACTIVE' },
    edited: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Number }
  },
  { timestamps: true }
);

// Indexes based on the specification
FeedCommentSchema.index({ feedLocalizationId: 1, parentId: 1, createdAt: -1 });
FeedCommentSchema.index({ parentId: 1, createdAt: 1 });
FeedCommentSchema.index({ workspaceId: 1, createdAt: -1 });

export const FeedComment = mongoose.model<IFeedComment>('FeedComment', FeedCommentSchema);
