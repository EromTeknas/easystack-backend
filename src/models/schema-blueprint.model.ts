import mongoose, { Schema, Document } from 'mongoose';
import { SchemaDefinition } from './feed-version.model';

export type SchemaBlueprintType = 'collection' | 'singleton';

export interface ISchemaBlueprint extends Document {
  projectId: number; // References MySQL Project ID
  name: string; // e.g., "Blog Post", "Homepage", "Product"
  slug: string; // e.g., "blog-posts", "homepage", "products"
  description?: string;
  type: SchemaBlueprintType; // 'collection' (multi-entry) or 'singleton' (single-entry)
  icon?: string; // e.g., "article", "home", "store", "chat", "feed"
  schemaDefinition: SchemaDefinition;
  activeVersionNumber: number;
  environmentVersions: Record<string, number>;
  environments: string[]; // e.g. ['development', 'staging', 'production']
  deployedAt?: Record<string, Date>;
  createdBy: number; // References MySQL User ID
  createdAt: Date;
  updatedAt: Date;
}

const SchemaBlueprintSchema = new Schema(
  {
    projectId: { type: Number, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    type: { 
      type: String, 
      enum: ['collection', 'singleton'], 
      default: 'collection',
      required: true 
    },
    icon: { type: String, default: 'article' },
    schemaDefinition: {
      version: { type: Number, default: 1 },
      fields: { type: Schema.Types.Mixed, default: [] },
    },
    activeVersionNumber: { type: Number, default: 1 },
    environmentVersions: {
      type: Schema.Types.Mixed,
      default: { development: 1, staging: 0, production: 0 },
    },
    environments: {
      type: [String],
      default: ['development'],
    },
    deployedAt: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: { type: Number, required: true },
  },
  { timestamps: true }
);


// Enforce unique slug per project
SchemaBlueprintSchema.index({ projectId: 1, slug: 1 }, { unique: true });

export const SchemaBlueprint = mongoose.model<ISchemaBlueprint>(
  'SchemaBlueprint',
  SchemaBlueprintSchema
);
