import { SchemaBlueprint, ISchemaBlueprint, SchemaBlueprintType } from '../models/schema-blueprint.model';
import { SchemaDefinition } from '../models/feed-version.model';

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
  async listByProject(projectId: number): Promise<ISchemaBlueprint[]> {
    return SchemaBlueprint.find({ projectId }).sort({ createdAt: -1 });
  },

  async findById(id: string): Promise<ISchemaBlueprint | null> {
    return SchemaBlueprint.findById(id);
  },

  async findBySlug(projectId: number, slug: string): Promise<ISchemaBlueprint | null> {
    return SchemaBlueprint.findOne({ projectId, slug: slug.toLowerCase().trim() });
  },

  async create(data: CreateSchemaBlueprintDto): Promise<ISchemaBlueprint> {
    const payload: any = {
      projectId: data.projectId,
      name: data.name,
      slug: data.slug.toLowerCase().trim(),
      type: data.type || 'collection',
      createdBy: data.createdBy,
      schemaDefinition: data.schemaDefinition || { version: 1, fields: [] },
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

  async delete(id: string): Promise<boolean> {
    const res = await SchemaBlueprint.findByIdAndDelete(id);
    return Boolean(res);
  },
};
