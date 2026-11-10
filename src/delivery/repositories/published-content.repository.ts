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

function buildPublishedEnvQuery(
  target: string[] | { environmentId?: number; environmentName?: string }
): any {
  if (Array.isArray(target)) {
    return { environment: { $in: target } };
  }
  const conditions: any[] = [];
  if (target.environmentId) {
    conditions.push({ environmentId: target.environmentId });
    conditions.push({ environment: String(target.environmentId) });
  }
  if (target.environmentName) {
    const clean = target.environmentName.toLowerCase().trim();
    conditions.push({ environment: clean });
    if (clean === 'dev' || clean === 'development') {
      conditions.push({ environment: { $in: ['dev', 'development'] } });
    }
    if (clean === 'live' || clean === 'production') {
      conditions.push({ environment: { $in: ['live', 'production'] } });
    }
  }
  if (conditions.length === 1) return conditions[0];
  if (conditions.length > 1) return { $or: conditions };
  return {};
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
    environmentTarget: string[] | { environmentId?: number; environmentName?: string }
  ): Promise<IContentEntry | null> {
    const envFilter = buildPublishedEnvQuery(environmentTarget);
    return ContentEntry.findOne({
      projectId,
      schemaSlug: schemaSlug.toLowerCase().trim(),
      status: 'published',
      ...envFilter,
    }).exec();
  },

  async findPublishedCollectionList(
    projectId: number,
    schemaSlug: string,
    environmentTarget: string[] | { environmentId?: number; environmentName?: string },
    options: PublishedCollectionQueryOptions = {}
  ): Promise<PublishedCollectionQueryResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const skip = (page - 1) * limit;

    const envFilter = buildPublishedEnvQuery(environmentTarget);
    const query: any = {
      projectId,
      schemaSlug: schemaSlug.toLowerCase().trim(),
      status: 'published',
      ...envFilter,
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
    environmentTarget: string[] | { environmentId?: number; environmentName?: string }
  ): Promise<IContentEntry | null> {
    const envFilter = buildPublishedEnvQuery(environmentTarget);
    return ContentEntry.findOne({
      projectId,
      schemaSlug: schemaSlug.toLowerCase().trim(),
      slug: entrySlug.toLowerCase().trim(),
      status: 'published',
      ...envFilter,
    }).exec();
  },
};
