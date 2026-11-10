import { SchemaBlueprint, ISchemaBlueprint, SchemaBlueprintType } from '../models/schema-blueprint.model';
import { SchemaDefinition } from '../types/schema.types';

export interface CreateSchemaBlueprintDto {
  projectId: number;
  name: string;
  slug: string;
  description?: string | undefined;
  type?: SchemaBlueprintType | undefined;
  icon?: string | undefined;
  schemaDefinition?: SchemaDefinition | undefined;
  createdBy: number;
}

export interface UpdateSchemaBlueprintDto {
  name?: string | undefined;
  slug?: string | undefined;
  description?: string | undefined;
  type?: SchemaBlueprintType | undefined;
  icon?: string | undefined;
  schemaDefinition?: SchemaDefinition | undefined;
  activeVersionNumber?: number | undefined;
  environmentVersions?: Record<string, number> | undefined;
  environments?: string[] | undefined;
}

export const SchemaBlueprintRepository = {
  async listByProject(projectId: number, includeRemoved: boolean = false): Promise<ISchemaBlueprint[]> {
    const filter: any = { projectId };
    if (!includeRemoved) {
      filter.removedAt = null;
    }
    return SchemaBlueprint.find(filter).sort({ createdAt: -1 });
  },

  async findById(id: string, includeRemoved: boolean = false): Promise<ISchemaBlueprint | null> {
    const filter: any = { _id: id };
    if (!includeRemoved) {
      filter.removedAt = null;
    }
    return SchemaBlueprint.findOne(filter);
  },

  async findBySlug(projectId: number, slug: string, includeRemoved: boolean = false): Promise<ISchemaBlueprint | null> {
    const filter: any = { projectId, slug: slug.toLowerCase().trim() };
    if (!includeRemoved) {
      filter.removedAt = null;
    }
    return SchemaBlueprint.findOne(filter);
  },

  async create(data: CreateSchemaBlueprintDto): Promise<ISchemaBlueprint> {
    const payload: any = {
      projectId: data.projectId,
      name: data.name,
      slug: data.slug.toLowerCase().trim(),
      type: data.type || 'collection',
      createdBy: data.createdBy,
      schemaDefinition: data.schemaDefinition || { version: 1, fields: [] },
      removedAt: null,
    };
    if (data.description !== undefined) payload.description = data.description;
    if (data.icon !== undefined) payload.icon = data.icon;

    return SchemaBlueprint.create(payload);
  },

  async update(id: string, data: UpdateSchemaBlueprintDto): Promise<ISchemaBlueprint | null> {
    const updatePayload: any = { ...data };
    if (data.slug) {
      updatePayload.slug = data.slug.toLowerCase().trim();
    }
    return SchemaBlueprint.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true }
    );
  },

  async softDelete(id: string): Promise<boolean> {
    const res = await SchemaBlueprint.findByIdAndUpdate(
      id,
      { $set: { removedAt: new Date() } },
      { new: true }
    );
    return Boolean(res);
  },

  async delete(id: string): Promise<boolean> {
    return this.softDelete(id);
  },
};
