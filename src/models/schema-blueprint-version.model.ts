import mongoose, { Schema, Document } from 'mongoose';
import { SchemaDefinition } from './feed-version.model';

export interface FieldChangeSummary {
  addedFields: string[];
  modifiedFields: string[];
  removedFields: string[];
}

export interface ISchemaBlueprintVersion extends Document {
  projectId: number;
  blueprintId: mongoose.Types.ObjectId;
  blueprintSlug: string;
  blueprintName: string;
  versionNumber: number; // 1, 2, 3...
  semanticVersion: string; // "v1.0.0", "v1.1.0"
  schemaDefinition: SchemaDefinition;
  summary: FieldChangeSummary;
  changelog?: string;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

const SchemaBlueprintVersionSchema = new Schema(
  {
    projectId: { type: Number, required: true, index: true },
    blueprintId: { type: Schema.Types.ObjectId, ref: 'SchemaBlueprint', required: true, index: true },
    blueprintSlug: { type: String, required: true, index: true },
    blueprintName: { type: String, required: true },
    versionNumber: { type: Number, required: true },
    semanticVersion: { type: String, required: true },
    schemaDefinition: {
      version: { type: Number, default: 1 },
      fields: { type: Schema.Types.Mixed, default: [] },
    },
    summary: {
      addedFields: { type: [String], default: [] },
      modifiedFields: { type: [String], default: [] },
      removedFields: { type: [String], default: [] },
    },
    changelog: { type: String },
    createdBy: { type: Number, required: true },
  },
  { timestamps: true }
);

SchemaBlueprintVersionSchema.index(
  { projectId: 1, blueprintId: 1, versionNumber: -1 },
  { unique: true }
);

export const SchemaBlueprintVersion = mongoose.model<ISchemaBlueprintVersion>(
  'SchemaBlueprintVersion',
  SchemaBlueprintVersionSchema
);
