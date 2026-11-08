import mongoose from 'mongoose';
import { SchemaBlueprint, ISchemaBlueprint } from '../../models/schema-blueprint.model';
import { SchemaBlueprintVersion, ISchemaBlueprintVersion } from '../../models/schema-blueprint-version.model';
import { ContentEntry, IContentEntry } from '../../models/content-entry.model';

export interface PublishedCollectionQueryOptions {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  sort?: string | undefined;
}

export interface PublishedCollectionQueryResult {
  entries: IContentEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export const PublishedContentRepository = {
  async findBlueprint(
    projectId: number,
    blueprintSlug: string
  ): Promise<ISchemaBlueprint | null> {
    return SchemaBlueprint.findOne({
      projectId,
      slug: blueprintSlug.toLowerCase().trim(),
      removedAt: null,
    }).exec();
  },

  async findBlueprintVersion(
    blueprintId: mongoose.Types.ObjectId,
    versionNumber: number
  ): Promise<ISchemaBlueprintVersion | null> {
    return SchemaBlueprintVersion.findOne({
      blueprintId,
      versionNumber,
    }).exec();
  },

  async findPublishedSingleton(
    projectId: number,
    schemaSlug: string,
    environmentAliases: string[]
  ): Promise<IContentEntry | null> {
    return ContentEntry.findOne({
      projectId,
      schemaSlug: schemaSlug.toLowerCase().trim(),
      environment: { $in: environmentAliases },
      status: 'published',
    }).exec();
  },

  async findPublishedCollectionList(
    projectId: number,
    schemaSlug: string,
    environmentAliases: string[],
    options: PublishedCollectionQueryOptions = {}
  ): Promise<PublishedCollectionQueryResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const skip = (page - 1) * limit;

    const query: any = {
      projectId,
      schemaSlug: schemaSlug.toLowerCase().trim(),
      environment: { $in: environmentAliases },
      status: 'published',
    };

    if (options.search && options.search.trim()) {
      const searchRegex = new RegExp(options.search.trim(), 'i');
      query.$or = [{ title: searchRegex }, { slug: searchRegex }];
    }

    // Sort parsing: e.g., "-createdAt" or "title" or "-publishedAt"
    let sortOptions: any = { publishedAt: -1, updatedAt: -1 };
    if (options.sort && typeof options.sort === 'string') {
      const sortField = options.sort.startsWith('-') ? options.sort.substring(1) : options.sort;
      const sortDirection = options.sort.startsWith('-') ? -1 : 1;
      const allowedSortFields = ['createdAt', 'updatedAt', 'publishedAt', 'title', 'slug'];
      if (allowedSortFields.includes(sortField)) {
        sortOptions = { [sortField]: sortDirection };
      }
    }

    const [entries, total] = await Promise.all([
      ContentEntry.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .exec(),
      ContentEntry.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    const hasMore = page < totalPages;

    return {
      entries,
      total,
      page,
      limit,
      totalPages,
      hasMore,
    };
  },

  async findPublishedCollectionEntry(
    projectId: number,
    schemaSlug: string,
    entrySlug: string,
    environmentAliases: string[]
  ): Promise<IContentEntry | null> {
    return ContentEntry.findOne({
      projectId,
      schemaSlug: schemaSlug.toLowerCase().trim(),
      slug: entrySlug.toLowerCase().trim(),
      environment: { $in: environmentAliases },
      status: 'published',
    }).exec();
  },
};
