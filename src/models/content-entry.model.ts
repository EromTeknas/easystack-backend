import mongoose, { Schema, Document } from 'mongoose';

export type ContentEntryStatus = 'draft' | 'scheduled' | 'published';

export interface TranslationStatusInfo {
  status: 'pending' | 'processing' | 'completed' | 'outdated' | 'failed';
  error?: string;
  outdatedFields?: string[];
  updatedAt?: Date;
}

export interface IContentEntry extends Document {
  projectId: number; // References MySQL Project ID
  schemaId: mongoose.Types.ObjectId; // References SchemaBlueprint
  schemaSlug: string; // e.g., "blog-posts"
  slug: string; // e.g., "my-first-post" or "default" for singletons
  title: string; // Human readable title
  status: ContentEntryStatus;
  environment: string; // e.g. "production", "staging", "development"
  scheduledAt?: Date;
  publishedAt?: Date;
  publishedContent?: Record<string, any>;
  publishedTitle?: string;
  publishedTranslations?: Record<string, Record<string, any>>;
  baseLanguage: string; // e.g., "en"
  content: Record<string, any>;
  translations?: Record<string, Record<string, any>> | undefined;
  translationStatuses?: Record<string, TranslationStatusInfo> | undefined;
  translationSourceHashes?: Record<string, Record<string, string>> | undefined;
  createdBy: number;
  updatedBy?: number | undefined;
  createdAt: Date;
  updatedAt: Date;
}

const ContentEntrySchema = new Schema(
  {
    projectId: { type: Number, required: true, index: true },
    schemaId: { type: Schema.Types.ObjectId, ref: 'SchemaBlueprint', required: true, index: true },
    schemaSlug: { type: String, required: true, index: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published'],
      default: 'draft',
      index: true,
    },
    environment: {
      type: String,
      default: 'development',
      index: true,
    },

    scheduledAt: { type: Date },
    publishedAt: { type: Date },
    publishedContent: { type: Schema.Types.Mixed },
    publishedTitle: { type: String },
    publishedTranslations: { type: Schema.Types.Mixed },
    baseLanguage: { type: String, default: 'en' },
    content: { type: Schema.Types.Mixed, default: {} },
    translations: { type: Schema.Types.Mixed, default: {} },
    translationStatuses: { type: Schema.Types.Mixed, default: {} },
    translationSourceHashes: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Number, required: true },
    updatedBy: { type: Number },
  },
  { timestamps: true }
);

// Enforce unique entry slug per schema within the same project & environment
ContentEntrySchema.index({ projectId: 1, schemaSlug: 1, environment: 1, slug: 1 }, { unique: true });
ContentEntrySchema.index({ projectId: 1, schemaSlug: 1, environment: 1, updatedAt: -1 });

export const ContentEntry = mongoose.model<IContentEntry>(
  'ContentEntry',
  ContentEntrySchema
);
