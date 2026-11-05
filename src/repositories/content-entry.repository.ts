import mongoose from 'mongoose';
import { ContentEntry, IContentEntry, ContentEntryStatus } from '../models/content-entry.model';

export interface CreateContentEntryDto {
  projectId: number;
  schemaId: mongoose.Types.ObjectId;
  schemaSlug: string;
  slug: string;
  title: string;
  status?: ContentEntryStatus | undefined;
  environment?: string | undefined;
  scheduledAt?: Date | null | undefined;
  publishedAt?: Date | null | undefined;
  publishedContent?: Record<string, any> | undefined;
  publishedTitle?: string | undefined;
  publishedTranslations?: Record<string, Record<string, any>> | undefined;
  baseLanguage?: string | undefined;
  content: Record<string, any>;
  translations?: Record<string, Record<string, any>> | undefined;
  translationStatuses?: Record<string, any> | undefined;
  createdBy: number;
}

export interface UpdateContentEntryDto {
  title?: string | undefined;
  slug?: string | undefined;
  status?: ContentEntryStatus | undefined;
  environment?: string | undefined;
  scheduledAt?: Date | null | undefined;
  publishedAt?: Date | null | undefined;
  publishedContent?: Record<string, any> | undefined;
  publishedTitle?: string | undefined;
  publishedTranslations?: Record<string, Record<string, any>> | undefined;
  baseLanguage?: string | undefined;
  content?: Record<string, any> | undefined;
  translations?: Record<string, Record<string, any>> | undefined;
  translationStatuses?: Record<string, any> | undefined;
  updatedBy?: number | undefined;
}

export interface ListContentEntriesOptions {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  status?: ContentEntryStatus | undefined;
  environment?: string | undefined;
}

export interface PaginatedContentEntries {
  entries: IContentEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const ContentEntryRepository = {
  async listBySchema(
    projectId: number,
    schemaSlug: string,
    options: ListContentEntriesOptions = {}
  ): Promise<PaginatedContentEntries> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const skip = (page - 1) * limit;

    const query: any = {
      projectId,
      schemaSlug: schemaSlug.toLowerCase().trim(),
    };

    if (options.status) {
      query.status = options.status;
    }

    const targetEnv = (options.environment || 'development').toLowerCase().trim();
    query.environment = targetEnv;

    if (options.search && options.search.trim()) {
      const searchRegex = new RegExp(options.search.trim(), 'i');
      query.$or = [{ title: searchRegex }, { slug: searchRegex }];
    }

    const [entries, total] = await Promise.all([
      ContentEntry.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      ContentEntry.countDocuments(query).exec(),
    ]);

    return {
      entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async findById(id: string): Promise<IContentEntry | null> {
    return ContentEntry.findById(id).exec();
  },

  async findBySlug(
    projectId: number,
    schemaSlug: string,
    slug: string,
    environment: string = 'development'
  ): Promise<IContentEntry | null> {
    return ContentEntry.findOne({
      projectId,
      schemaSlug: schemaSlug.toLowerCase().trim(),
      slug: slug.toLowerCase().trim(),
      environment: environment.toLowerCase().trim(),
    }).exec();
  },

  async findSingleton(
    projectId: number,
    schemaSlug: string,
    environment: string = 'development'
  ): Promise<IContentEntry | null> {
    return ContentEntry.findOne({
      projectId,
      schemaSlug: schemaSlug.toLowerCase().trim(),
      environment: environment.toLowerCase().trim(),
    }).exec();
  },

  async create(data: CreateContentEntryDto): Promise<IContentEntry> {
    const payload: any = {
      projectId: data.projectId,
      schemaId: data.schemaId,
      schemaSlug: data.schemaSlug.toLowerCase().trim(),
      slug: data.slug.toLowerCase().trim(),
      title: data.title.trim(),
      status: data.status || 'draft',
      environment: (data.environment || 'development').toLowerCase().trim(),

      scheduledAt: data.scheduledAt,
      publishedAt: data.publishedAt,
      baseLanguage: data.baseLanguage || 'en',
      content: data.content || {},
      createdBy: data.createdBy,
    };
    if (data.translations !== undefined) payload.translations = data.translations;
    if (data.translationStatuses !== undefined) payload.translationStatuses = data.translationStatuses;

    return ContentEntry.create(payload);
  },

  async update(
    id: string,
    data: UpdateContentEntryDto
  ): Promise<IContentEntry | null> {
    const updatePayload: any = {};
    if (data.title !== undefined) updatePayload.title = data.title.trim();
    if (data.slug !== undefined) updatePayload.slug = data.slug.toLowerCase().trim();
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.environment !== undefined) updatePayload.environment = data.environment;
    if (data.scheduledAt !== undefined) updatePayload.scheduledAt = data.scheduledAt;
    if (data.publishedAt !== undefined) updatePayload.publishedAt = data.publishedAt;
    if (data.baseLanguage !== undefined) updatePayload.baseLanguage = data.baseLanguage;
    if (data.content !== undefined) updatePayload.content = data.content;
    if (data.translations !== undefined) updatePayload.translations = data.translations;
    if (data.translationStatuses !== undefined) updatePayload.translationStatuses = data.translationStatuses;
    if (data.updatedBy !== undefined) updatePayload.updatedBy = data.updatedBy;

    return ContentEntry.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).exec();
  },

  async delete(id: string): Promise<boolean> {
    const res = await ContentEntry.findByIdAndDelete(id).exec();
    return Boolean(res);
  },

  async countBySchema(projectId: number, schemaSlug: string): Promise<number> {
    return ContentEntry.countDocuments({
      projectId,
      schemaSlug: schemaSlug.toLowerCase().trim(),
    }).exec();
  },
};
