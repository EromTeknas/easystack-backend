import mongoose from 'mongoose';
import {
  ContentEntryRepository,
  UpdateContentEntryDto,
  ListContentEntriesOptions,
  PaginatedContentEntries,
} from '../repositories/content-entry.repository';
import { SchemaBlueprintRepository } from '../repositories/schema-blueprint.repository';
import { FeedSchemaValidationService } from './feed-schema-validation.service';
import { BadRequestError, NotFoundError, ConflictError } from '../errors';
import { prisma } from '../db';
import { IContentEntry, ContentEntryStatus } from '../models/content-entry.model';
import { ContentAuditService } from './content-audit.service';
import { ContentAuditAction } from '../models/content-audit-log.model';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const ContentEntryService = {
  async assertProjectExists(projectId: number) {
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new BadRequestError('Invalid projectId');
    }
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return project;
  },

  async getSchema(projectId: number, schemaSlug: string, environment: string = 'development') {
    await this.assertProjectExists(projectId);
    const schema = await SchemaBlueprintRepository.findBySlug(projectId, schemaSlug);
    if (!schema) {
      throw new NotFoundError(`Schema '${schemaSlug}' not found in this project`);
    }

    const targetEnv = (environment || 'development').toLowerCase().trim();
    if (targetEnv === 'development') {
      return schema;
    }

    // For non-development environments, check deployed version
    const deployedVersion = schema.environmentVersions?.[targetEnv] || 0;
    if (deployedVersion <= 0) {
      throw new NotFoundError(`Blueprint '${schemaSlug}' is not deployed to '${targetEnv}'`);
    }

    const { SchemaBlueprintVersion } = await import('../models/schema-blueprint-version.model');
    const versionDoc = await SchemaBlueprintVersion.findOne({
      blueprintId: schema._id,
      versionNumber: deployedVersion,
    });

    if (versionDoc && versionDoc.schemaDefinition) {
      const cloned = schema.toObject ? schema.toObject() : { ...schema };
      cloned.schemaDefinition = versionDoc.schemaDefinition;
      return cloned;
    }

    return schema;
  },

  async listEntries(
    projectId: number,
    schemaSlug: string,
    options: ListContentEntriesOptions = {}
  ): Promise<{
    schema: any;
    isSingleton: boolean;
    data: PaginatedContentEntries | { entry: IContentEntry | null };
  }> {
    const targetEnv = (options.environment || 'development').toLowerCase().trim();
    const schema = await this.getSchema(projectId, schemaSlug, targetEnv);

    if (schema.type === 'singleton') {
      const singleton = await ContentEntryRepository.findSingleton(projectId, schemaSlug, targetEnv);
      if (singleton && singleton.status === 'published' && !singleton.publishedContent) {
        singleton.publishedContent = singleton.content;
        singleton.publishedTitle = singleton.title;
        singleton.publishedAt = singleton.publishedAt || singleton.updatedAt || singleton.createdAt;
      }
      return {
        schema,
        isSingleton: true,
        data: { entry: singleton },
      };
    }

    const paginated = await ContentEntryRepository.listBySchema(projectId, schemaSlug, {
      ...options,
      environment: targetEnv,
    });
    paginated.entries.forEach((e) => {
      if (e.status === 'published' && !e.publishedContent) {
        e.publishedContent = e.content;
        e.publishedTitle = e.title;
        e.publishedAt = e.publishedAt || e.updatedAt || e.createdAt;
      }
    });
    return {
      schema,
      isSingleton: false,
      data: paginated,
    };
  },

  async getEntry(
    projectId: number,
    schemaSlug: string,
    entryIdOrSlug: string,
    environment: string = 'development'
  ): Promise<{ schema: any; entry: IContentEntry }> {
    const targetEnv = (environment || 'development').toLowerCase().trim();
    const schema = await this.getSchema(projectId, schemaSlug, targetEnv);

    if (schema.type === 'singleton') {
      const singleton = await ContentEntryRepository.findSingleton(projectId, schemaSlug, targetEnv);
      if (!singleton) {
        throw new NotFoundError(`Singleton entry for '${schemaSlug}' not yet initialized in '${targetEnv}'`);
      }
      if (singleton.status === 'published' && !singleton.publishedContent) {
        singleton.publishedContent = singleton.content;
        singleton.publishedTitle = singleton.title;
        singleton.publishedAt = singleton.publishedAt || singleton.updatedAt || singleton.createdAt;
      }
      return { schema, entry: singleton };
    }

    let entry: IContentEntry | null = null;
    if (mongoose.Types.ObjectId.isValid(entryIdOrSlug)) {
      entry = await ContentEntryRepository.findById(entryIdOrSlug);
    }
    if (!entry) {
      entry = await ContentEntryRepository.findBySlug(projectId, schemaSlug, entryIdOrSlug, targetEnv);
    }

    if (!entry || entry.projectId !== projectId || entry.schemaSlug !== schemaSlug.toLowerCase().trim()) {
      throw new NotFoundError(`Entry '${entryIdOrSlug}' not found in schema '${schemaSlug}'`);
    }

    if (entry.status === 'published' && !entry.publishedContent) {
      entry.publishedContent = entry.content;
      entry.publishedTitle = entry.title;
      entry.publishedAt = entry.publishedAt || entry.updatedAt || entry.createdAt;
    }

    return { schema, entry };
  },

  async checkSlugAvailability(
    projectId: number,
    schemaSlug: string,
    slug: string,
    excludeId?: string,
    environment: string = 'development'
  ): Promise<{ available: boolean; reason?: string }> {
    await this.assertProjectExists(projectId);
    const cleanSlug = slug.toLowerCase().trim();
    if (!cleanSlug) {
      return { available: false, reason: 'Slug cannot be empty' };
    }
    if (!SLUG_REGEX.test(cleanSlug)) {
      return {
        available: false,
        reason: 'Slug must contain only lowercase letters, numbers, and hyphens (e.g. my-first-post)',
      };
    }

    const existing = await ContentEntryRepository.findBySlug(
      projectId,
      schemaSlug,
      cleanSlug,
      environment
    );
    if (existing && (!excludeId || existing._id.toString() !== excludeId)) {
      return { available: false, reason: 'An entry with this slug already exists in this environment' };
    }

    return { available: true };
  },

  async createEntry(
    projectId: number,
    schemaSlug: string,
    userId: number,
    data: {
      title?: string | undefined;
      slug?: string | undefined;
      status?: ContentEntryStatus | undefined;
      environment?: string | undefined;
      baseLanguage?: string | undefined;
      content: Record<string, any>;
      translations?: Record<string, Record<string, any>> | undefined;
    }
  ): Promise<IContentEntry> {
    const targetEnv = (data.environment || 'development').toLowerCase().trim();
    const schema = await this.getSchema(projectId, schemaSlug, targetEnv);

    if (schema.type === 'singleton') {
      const existing = await ContentEntryRepository.findSingleton(projectId, schemaSlug, targetEnv);
      if (existing) {
        throw new BadRequestError(`Singleton entry already exists in '${targetEnv}'. Use update instead.`);
      }

      const isDraft = (data.status || 'draft') === 'draft';
      const defaultContent = schema.schemaDefinition
        ? FeedSchemaValidationService.generateDefaultContent(schema.schemaDefinition)
        : {};
      const mergedContent = { ...defaultContent, ...(data.content || {}) };

      if (schema.schemaDefinition && schema.schemaDefinition.fields) {
        FeedSchemaValidationService.validateContentAgainstSchema(mergedContent, schema.schemaDefinition, { isDraft });
      }

      const isPublished = (data.status || 'draft') === 'published';
      const created = await ContentEntryRepository.create({
        projectId,
        schemaId: schema._id as mongoose.Types.ObjectId,
        schemaSlug: schema.slug,
        slug: 'default',
        title: data.title?.trim() || schema.name,
        status: data.status || 'draft',
        environment: targetEnv,
        baseLanguage: data.baseLanguage || 'en',
        content: mergedContent,
        translations: data.translations,
        publishedAt: isPublished ? new Date() : undefined,
        publishedContent: isPublished ? mergedContent : undefined,
        publishedTitle: isPublished ? (data.title?.trim() || schema.name) : undefined,
        publishedTranslations: isPublished ? data.translations : undefined,
        createdBy: userId,
      });

      await ContentAuditService.log({
        projectId,
        schemaSlug: schema.slug,
        contentEntryId: created._id.toString(),
        environment: targetEnv,
        action: 'CREATED',
        userId,
        message: `Created singleton content entry for '${schema.name}' in '${targetEnv}'`,
        details: { title: created.title, status: created.status },
      });

      return created;
    }

    const title = data.title?.trim();
    if (!title) {
      throw new BadRequestError('Entry title is required');
    }

    let slug = data.slug?.toLowerCase().trim();
    if (!slug) {
      slug = slugify(title);
      if (!slug) {
        slug = `entry-${Date.now()}`;
      }
    }

    const availability = await this.checkSlugAvailability(projectId, schemaSlug, slug, undefined, targetEnv);
    if (!availability.available) {
      throw new ConflictError(availability.reason || 'Slug is already in use');
    }

    const isDraft = (data.status || 'draft') === 'draft';
    const defaultContent = schema.schemaDefinition
      ? FeedSchemaValidationService.generateDefaultContent(schema.schemaDefinition)
      : {};
    const mergedContent = { ...defaultContent, ...(data.content || {}) };

    if (schema.schemaDefinition && schema.schemaDefinition.fields) {
      FeedSchemaValidationService.validateContentAgainstSchema(mergedContent, schema.schemaDefinition, { isDraft });
    }

    const isPublished = (data.status || 'draft') === 'published';
    const created = await ContentEntryRepository.create({
      projectId,
      schemaId: schema._id as mongoose.Types.ObjectId,
      schemaSlug: schema.slug,
      slug,
      title,
      status: data.status || 'draft',
      environment: targetEnv,
      baseLanguage: data.baseLanguage || 'en',
      content: mergedContent,
      publishedAt: isPublished ? new Date() : undefined,
      publishedContent: isPublished ? mergedContent : undefined,
      publishedTitle: isPublished ? title : undefined,
      publishedTranslations: isPublished ? (data.translations || {}) : undefined,
      translations: data.translations,
      createdBy: userId,
    });

    await ContentAuditService.log({
      projectId,
      schemaSlug: schema.slug,
      contentEntryId: created._id.toString(),
      environment: targetEnv,
      action: 'CREATED',
      userId,
      message: `Created content entry '${created.title}' (${created.slug}) in '${targetEnv}'`,
      details: { title: created.title, slug: created.slug, status: created.status },
    });

    return created;
  },

  async updateEntry(
    projectId: number,
    schemaSlug: string,
    entryId: string,
    userId: number,
    data: {
      title?: string | undefined;
      slug?: string | undefined;
      status?: ContentEntryStatus | undefined;
      environment?: string | undefined;
      baseLanguage?: string | undefined;
      content?: Record<string, any> | undefined;
      translations?: Record<string, Record<string, any>> | undefined;
    }
  ): Promise<IContentEntry> {
    const targetEnv = (data.environment || 'development').toLowerCase().trim();
    const schema = await this.getSchema(projectId, schemaSlug, targetEnv);

    let existing: IContentEntry | null = null;
    if (schema.type === 'singleton') {
      existing = await ContentEntryRepository.findSingleton(projectId, schemaSlug, targetEnv);
      if (!existing) {
        const isDraft = (data.status || 'draft') === 'draft';
        const defaultContent = schema.schemaDefinition
          ? FeedSchemaValidationService.generateDefaultContent(schema.schemaDefinition)
          : {};
        const mergedContent = { ...defaultContent, ...(data.content || {}) };
        if (schema.schemaDefinition && schema.schemaDefinition.fields) {
          FeedSchemaValidationService.validateContentAgainstSchema(mergedContent, schema.schemaDefinition, { isDraft });
        }
        const isPublished = (data.status || 'draft') === 'published';
        const createdSingleton = await ContentEntryRepository.create({
          projectId,
          schemaId: schema._id as mongoose.Types.ObjectId,
          schemaSlug: schema.slug,
          slug: 'default',
          title: data.title?.trim() || schema.name,
          status: data.status || 'draft',
          environment: targetEnv,
          baseLanguage: data.baseLanguage || 'en',
          content: mergedContent,
          translations: data.translations,
          publishedAt: isPublished ? new Date() : undefined,
          publishedContent: isPublished ? mergedContent : undefined,
          publishedTitle: isPublished ? (data.title?.trim() || schema.name) : undefined,
          publishedTranslations: isPublished ? data.translations : undefined,
          createdBy: userId,
        });

        await ContentAuditService.log({
          projectId,
          schemaSlug: schema.slug,
          contentEntryId: createdSingleton._id.toString(),
          environment: targetEnv,
          action: 'CREATED',
          userId,
          message: `Created singleton content entry for '${schema.name}' in '${targetEnv}'`,
          details: { title: createdSingleton.title, status: createdSingleton.status },
        });

        return createdSingleton;
      }
    } else {
      if (mongoose.Types.ObjectId.isValid(entryId)) {
        existing = await ContentEntryRepository.findById(entryId);
      }
      if (!existing) {
        existing = await ContentEntryRepository.findBySlug(projectId, schemaSlug, entryId, targetEnv);
      }
    }

    if (!existing || existing.projectId !== projectId || existing.schemaSlug !== schemaSlug.toLowerCase().trim()) {
      throw new NotFoundError('Content entry not found');
    }

    const updatePayload: UpdateContentEntryDto = {
      updatedBy: userId,
    };

    if (data.title !== undefined) {
      if (!data.title.trim()) {
        throw new BadRequestError('Title cannot be empty');
      }
      updatePayload.title = data.title.trim();
    }

    if (data.slug !== undefined && schema.type !== 'singleton') {
      const cleanSlug = data.slug.toLowerCase().trim();
      if (cleanSlug !== existing.slug) {
        const availability = await this.checkSlugAvailability(
          projectId,
          schemaSlug,
          cleanSlug,
          existing._id.toString(),
          existing.environment
        );
        if (!availability.available) {
          throw new ConflictError(availability.reason || 'Slug is already in use');
        }
        updatePayload.slug = cleanSlug;
      }
    }

    const isPreviouslyPublished = Boolean(
      existing.publishedAt || existing.publishedContent || existing.status === 'published'
    );

    // If previously published and publishedContent is not yet initialized in DB, snapshot existing content
    if (isPreviouslyPublished && !existing.publishedContent) {
      updatePayload.publishedContent = existing.content;
      updatePayload.publishedTitle = existing.publishedTitle || existing.title;
      updatePayload.publishedTranslations = existing.publishedTranslations || existing.translations || {};
      updatePayload.publishedAt = existing.publishedAt || existing.updatedAt || new Date();
    }

    if (data.status !== undefined) {
      updatePayload.status = data.status;
    }

    if (data.baseLanguage !== undefined) {
      updatePayload.baseLanguage = data.baseLanguage;
    }

    const targetStatus = data.status || existing.status;
    const isDraft = targetStatus === 'draft';

    if (data.content !== undefined) {
      if (schema.schemaDefinition && schema.schemaDefinition.fields) {
        FeedSchemaValidationService.validateContentAgainstSchema(data.content, schema.schemaDefinition, { isDraft });
      }
      updatePayload.content = data.content;

      // Automated Outdated Translation Detection (GAP-07)
      if (schema.schemaDefinition && schema.schemaDefinition.fields) {
        const localizedFields = schema.schemaDefinition.fields.filter((f: any) => f.isLocalized);
        const localizedKeys = localizedFields.map((f: any) => f.key || f.id);

        if (localizedKeys.length > 0) {
          const changedLocalizedKeys = localizedKeys.filter((k: string) => {
            const oldVal = existing.content?.[k];
            const newVal = data.content?.[k];
            return JSON.stringify(oldVal) !== JSON.stringify(newVal);
          });

          const currentStatuses: Record<string, any> = { ...(existing.translationStatuses || {}) };
          const project = await prisma.project.findUnique({ where: { id: projectId } });
          const projectLangs = (project?.supportedLanguages as string[]) || [];
          const baseLang = data.baseLanguage || existing.baseLanguage || 'en';
          const defaultTargets = projectLangs.length > 1
            ? projectLangs.filter((l) => l !== baseLang)
            : ['es', 'fr'].filter((l) => l !== baseLang);

          const targetLangs = new Set<string>([
            ...defaultTargets,
            ...Object.keys(existing.translations || {}),
            ...Object.keys(currentStatuses),
          ]);

          let hasStatusUpdate = false;
          for (const lang of targetLangs) {
            if (changedLocalizedKeys.length > 0) {
              const existingOutdated = currentStatuses[lang]?.outdatedFields || [];
              const mergedOutdated = Array.from(new Set([...existingOutdated, ...changedLocalizedKeys]));
              currentStatuses[lang] = {
                ...(currentStatuses[lang] || {}),
                status: 'outdated',
                outdatedFields: mergedOutdated,
                updatedAt: new Date(),
              };
              hasStatusUpdate = true;
            } else if (!currentStatuses[lang]) {
              currentStatuses[lang] = {
                status: 'outdated',
                outdatedFields: localizedKeys,
                updatedAt: new Date(),
              };
              hasStatusUpdate = true;
            }
          }

          if (hasStatusUpdate) {
            updatePayload.translationStatuses = currentStatuses;
          }
        }
      }
    } else if (data.status !== undefined && !isDraft) {
      if (schema.schemaDefinition && schema.schemaDefinition.fields) {
        FeedSchemaValidationService.validateContentAgainstSchema(existing.content, schema.schemaDefinition, { isDraft: false });
      }
    }

    if (data.status === 'published') {
      updatePayload.status = 'published';
      updatePayload.publishedAt = new Date();
      updatePayload.publishedContent = data.content !== undefined ? data.content : existing.content;
      updatePayload.publishedTitle = data.title?.trim() || existing.title;
      updatePayload.publishedTranslations = data.translations !== undefined ? data.translations : (existing.translations || {});
    }

    if (data.translations !== undefined) {
      updatePayload.translations = data.translations;

      // If manual translations were provided for specific languages, mark them completed and clear outdatedFields
      const currentStatuses: Record<string, any> = updatePayload.translationStatuses || { ...(existing.translationStatuses || {}) };
      for (const lang of Object.keys(data.translations)) {
        currentStatuses[lang] = {
          ...(currentStatuses[lang] || {}),
          status: 'completed',
          outdatedFields: [],
          updatedAt: new Date(),
        };
      }
      updatePayload.translationStatuses = currentStatuses;
    }

    const updated = await ContentEntryRepository.update(existing._id.toString(), updatePayload);
    if (!updated) {
      throw new NotFoundError('Failed to update content entry');
    }

    const isTranslationEdit = data.translations !== undefined && data.content === undefined;
    const isDraftSave = data.status === 'draft' || (!data.status && existing.status === 'draft');
    const action: ContentAuditAction = isDraftSave
      ? 'DRAFT_SAVED'
      : isTranslationEdit
      ? 'TRANSLATION_OVERRIDDEN'
      : 'UPDATED';
    const msg = isDraftSave
      ? `Saved draft for '${updated.title}'`
      : isTranslationEdit
      ? `Updated manual translations for '${updated.title}'`
      : `Updated content entry '${updated.title}'`;

    await ContentAuditService.log({
      projectId,
      schemaSlug: schema.slug,
      contentEntryId: updated._id.toString(),
      environment: updated.environment,
      action,
      userId,
      message: msg,
      details: {
        changedKeys: Object.keys(updatePayload),
        status: updated.status,
      },
    });

    return updated;
  },

  async deleteEntry(projectId: number, schemaSlug: string, entryId: string, userId?: number): Promise<void> {
    const schema = await this.getSchema(projectId, schemaSlug);
    if (schema.type === 'singleton') {
      throw new BadRequestError(
        'Singleton content cannot be deleted. You can clear or update its content fields instead.'
      );
    }

    let existing: IContentEntry | null = null;
    if (mongoose.Types.ObjectId.isValid(entryId)) {
      existing = await ContentEntryRepository.findById(entryId);
    }
    if (!existing) {
      existing = await ContentEntryRepository.findBySlug(projectId, schemaSlug, entryId);
    }

    if (!existing || existing.projectId !== projectId || existing.schemaSlug !== schemaSlug.toLowerCase().trim()) {
      throw new NotFoundError('Content entry not found');
    }

    await ContentAuditService.log({
      projectId,
      schemaSlug: schema.slug,
      contentEntryId: existing._id.toString(),
      environment: existing.environment,
      action: 'DELETED',
      userId,
      message: `Deleted content entry '${existing.title}' (${existing.slug})`,
      details: { title: existing.title, slug: existing.slug },
    });

    await ContentEntryRepository.delete(existing._id.toString());
  },

  async discardDraft(
    projectId: number,
    schemaSlug: string,
    entryId: string,
    userId: number,
    environment: string = 'development'
  ): Promise<{ entry: IContentEntry | null; discarded: boolean; message: string }> {
    const targetEnv = (environment || 'development').toLowerCase().trim();
    const { schema, entry } = await this.getEntry(projectId, schemaSlug, entryId, targetEnv);

    // If entry was previously published, revert to published snapshot
    if (entry.publishedContent && entry.publishedAt) {
      const localizedFields = schema.schemaDefinition?.fields?.filter((f: any) => f.isLocalized) || [];
      const updatePayload: UpdateContentEntryDto = {
        content: entry.publishedContent,
        title: entry.publishedTitle || entry.title,
        status: 'published',
        updatedBy: userId,
      };

      if (localizedFields.length > 0) {
        const localizedKeys = localizedFields.map((f: any) => f.key || f.id);
        const currentStatuses: Record<string, any> = { ...(entry.translationStatuses || {}) };
        const targetLangs = new Set<string>([
          ...Object.keys(entry.translations || {}),
          ...Object.keys(currentStatuses),
        ]);
        for (const lang of targetLangs) {
          const existingOutdated = currentStatuses[lang]?.outdatedFields || [];
          const mergedOutdated = Array.from(new Set([...existingOutdated, ...localizedKeys]));
          currentStatuses[lang] = {
            ...(currentStatuses[lang] || {}),
            status: 'outdated',
            outdatedFields: mergedOutdated,
            updatedAt: new Date(),
          };
        }
        updatePayload.translationStatuses = currentStatuses;
      }

      const restored = await ContentEntryRepository.update(entry._id.toString(), updatePayload);

      if (!restored) {
        throw new NotFoundError('Failed to revert content entry to published version');
      }

      await ContentAuditService.log({
        projectId,
        schemaSlug: schema.slug,
        contentEntryId: restored._id.toString(),
        environment: targetEnv,
        action: 'DRAFT_DISCARDED',
        userId,
        message: `Discarded draft changes and reverted '${restored.title}' to published version`,
        details: { revertedToPublishedAt: entry.publishedAt },
      });

      return {
        entry: restored,
        discarded: true,
        message: 'Draft changes discarded. Reverted to published version.',
      };
    }

    // If never published and not singleton, delete the draft entry
    if (schema.type !== 'singleton') {
      await this.deleteEntry(projectId, schemaSlug, entry._id.toString(), userId);
      return {
        entry: null,
        discarded: true,
        message: 'Draft entry permanently deleted.',
      };
    } else {
      // For singleton never published, clear content to defaults
      const defaultContent = schema.schemaDefinition
        ? FeedSchemaValidationService.generateDefaultContent(schema.schemaDefinition)
        : {};
      const cleared = await ContentEntryRepository.update(entry._id.toString(), {
        content: defaultContent,
        status: 'draft',
        updatedBy: userId,
      });
      return {
        entry: cleared,
        discarded: true,
        message: 'Singleton draft reset to schema defaults.',
      };
    }
  },

  async queueTranslationsForEntry(projectId: number, entry: IContentEntry, userId: number): Promise<void> {
    try {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || !project.supportedLanguages || !Array.isArray(project.supportedLanguages)) {
        return;
      }
      const supportedLanguages = project.supportedLanguages as string[];
      const baseLanguage = entry.baseLanguage || 'en';

      const { translationQueue } = require('./feed/infrastructure/queue/translation.queue');

      const statuses: Record<string, any> = (entry.translationStatuses as any) || {};
      for (const lang of supportedLanguages) {
        if (lang === baseLanguage) continue;

        statuses[lang] = {
          status: 'pending',
          updatedAt: new Date(),
        };

        await translationQueue.add('translate-content-entry', {
          contentEntryId: entry._id.toString(),
          targetLang: lang,
          userId,
        });
      }

      await ContentEntryRepository.update(entry._id.toString(), {
        translationStatuses: statuses,
      });
    } catch (err) {
      console.error('Failed to enqueue translation for content entry:', err);
    }
  },

  async publishEntry(
    projectId: number,
    schemaSlug: string,
    entryId: string,
    userId: number,
    targetEnv: string = 'development',
    forcePublish: boolean = false
  ): Promise<IContentEntry> {
    const cleanTarget = (targetEnv || 'development').toLowerCase().trim();
    const { schema, entry } = await this.getEntry(projectId, schemaSlug, entryId, cleanTarget);

    let forcePublishStatuses: Record<string, any> | undefined;

    // Validate required fields
    if (schema.schemaDefinition && schema.schemaDefinition.fields) {
      FeedSchemaValidationService.validateContentAgainstSchema(entry.content, schema.schemaDefinition, {
        isDraft: false,
      });

      // Guard: Block publication if localized fields exist and translations are incomplete/outdated
      const localizedFields = schema.schemaDefinition.fields.filter((f: any) => f.isLocalized);
      if (localizedFields.length > 0) {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        const projectLanguages = (project?.supportedLanguages as string[]) || [];
        const baseLang = entry.baseLanguage || 'en';
        let targetLanguages = projectLanguages.filter((l) => l !== baseLang);
        if (targetLanguages.length === 0) {
          const recordedLangs = Object.keys(entry.translationStatuses || {}).concat(
            Object.keys(entry.translations || {})
          );
          if (recordedLangs.length > 0) {
            targetLanguages = Array.from(new Set(recordedLangs)).filter((l) => l !== baseLang);
          } else {
            targetLanguages = ['es', 'fr'].filter((l) => l !== baseLang);
          }
        }

        if (targetLanguages.length > 0) {
          const statuses: Record<string, any> = entry.translationStatuses || {};
          const missingOrIncomplete = targetLanguages.filter((lang) => {
            const raw = statuses[lang];
            const st = typeof raw === 'object' && raw !== null ? raw.status : raw;
            const hasOutdated = Array.isArray(raw?.outdatedFields) && raw.outdatedFields.length > 0;
            return st !== 'completed' || hasOutdated;
          });

          if (missingOrIncomplete.length > 0) {
            if (!forcePublish) {
              throw new BadRequestError(
                `Cannot publish entry: Translations are missing or outdated for: ${missingOrIncomplete
                  .map((l) => l.toUpperCase())
                  .join(', ')}. All localized translations must be generated and up to date before publishing.`
              );
            } else {
              // Forced publish: Mark all target translations as ready as-is
              forcePublishStatuses = { ...statuses };
              for (const lang of targetLanguages) {
                forcePublishStatuses[lang] = {
                  ...(forcePublishStatuses[lang] || {}),
                  status: 'completed',
                  outdatedFields: [],
                  updatedAt: new Date(),
                };
              }
            }
          }
        }
      }
    }

    const updatePayload: UpdateContentEntryDto = {
      status: 'published',
      publishedAt: new Date(),
      publishedContent: entry.content,
      publishedTitle: entry.title,
      publishedTranslations: entry.translations || {},
      scheduledAt: null,
      updatedBy: userId,
    };

    if (forcePublishStatuses) {
      updatePayload.translationStatuses = forcePublishStatuses;
    }

    const updated = await ContentEntryRepository.update(entry._id.toString(), updatePayload);

    if (!updated) {
      throw new NotFoundError('Failed to publish content entry');
    }

    await ContentAuditService.log({
      projectId,
      schemaSlug: schema.slug,
      contentEntryId: updated._id.toString(),
      environment: updated.environment,
      action: 'PUBLISHED',
      userId,
      message: `Published content entry '${updated.title}' in '${updated.environment}'`,
      details: {
        title: updated.title,
        slug: updated.slug,
        environment: updated.environment,
        forcePublished: Boolean(forcePublish && forcePublishStatuses),
      },
    });

    return updated;
  },

  async triggerTranslations(
    projectId: number,
    schemaSlug: string,
    entryId: string,
    userId: number,
    languages?: string[]
  ): Promise<{ message: string; queuedLanguages: string[] }> {
    await this.assertProjectExists(projectId);
    const { schema, entry } = await this.getEntry(projectId, schemaSlug, entryId);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    let projectLanguages = (project?.supportedLanguages as string[]) || [];
    const baseLang = entry.baseLanguage || 'en';

    let targetLanguages = languages && languages.length > 0
      ? languages.filter((l) => l !== baseLang)
      : projectLanguages.filter((l) => l !== baseLang);

    if (targetLanguages.length === 0 && projectLanguages.length <= 1) {
      // Default to common project target languages if not explicitly configured
      targetLanguages = ['es', 'fr'].filter((l) => l !== baseLang);
      try {
        const merged = Array.from(new Set([...projectLanguages, ...targetLanguages]));
        await prisma.project.update({
          where: { id: projectId },
          data: { supportedLanguages: merged },
        });
      } catch {
        // Non-blocking
      }
    } else if (languages && languages.length > 0) {
      const newLangs = languages.filter((l) => !projectLanguages.includes(l));
      if (newLangs.length > 0) {
        try {
          const merged = Array.from(new Set([...projectLanguages, ...newLangs]));
          await prisma.project.update({
            where: { id: projectId },
            data: { supportedLanguages: merged },
          });
        } catch {
          // Non-blocking
        }
      }
    }

    if (targetLanguages.length === 0) {
      return {
        message: 'No supported target languages found to translate',
        queuedLanguages: [],
      };
    }

    const { translationQueue } = require('./feed/infrastructure/queue/translation.queue');
    const statuses: Record<string, any> = (entry.translationStatuses as any) || {};

    for (const lang of targetLanguages) {
      statuses[lang] = {
        status: 'pending',
        updatedAt: new Date(),
      };

      await translationQueue.add('translate-content-entry', {
        contentEntryId: entry._id.toString(),
        targetLang: lang,
        userId,
      });
    }

    await ContentEntryRepository.update(entry._id.toString(), {
      translationStatuses: statuses,
    });

    await ContentAuditService.log({
      projectId,
      schemaSlug: schema.slug,
      contentEntryId: entry._id.toString(),
      environment: entry.environment,
      action: 'AI_TRANSLATION_TRIGGERED',
      userId,
      message: `Triggered AI translation for languages: ${targetLanguages.join(', ').toUpperCase()}`,
      details: { queuedLanguages: targetLanguages },
    });

    return {
      message: `Translations queued for: ${targetLanguages.join(', ')}`,
      queuedLanguages: targetLanguages,
    };
  },

  async scheduleEntry(
    projectId: number,
    schemaSlug: string,
    entryId: string,
    scheduledAt: string,
    userId: number,
    targetEnv: string = 'production'
  ): Promise<IContentEntry> {
    const { schema, entry } = await this.getEntry(projectId, schemaSlug, entryId);

    const scheduleDate = new Date(scheduledAt);
    if (isNaN(scheduleDate.getTime()) || scheduleDate <= new Date()) {
      throw new BadRequestError('Scheduled publish time must be a valid future date and time');
    }

    if (schema.schemaDefinition && schema.schemaDefinition.fields) {
      FeedSchemaValidationService.validateContentAgainstSchema(entry.content, schema.schemaDefinition, {
        isDraft: false,
      });
    }

    const updated = await ContentEntryRepository.update(entry._id.toString(), {
      status: 'scheduled',
      scheduledAt: scheduleDate,
      updatedBy: userId,
    });

    if (!updated) {
      throw new NotFoundError('Failed to schedule content entry');
    }

    await ContentAuditService.log({
      projectId,
      schemaSlug: schema.slug,
      contentEntryId: updated._id.toString(),
      environment: updated.environment,
      action: 'SCHEDULED',
      userId,
      message: `Scheduled content entry '${updated.title}' for publication at ${scheduleDate.toISOString()}`,
      details: { scheduledAt: scheduleDate, targetEnv },
    });

    return updated;
  },

  async syncEnvironmentData(
    projectId: number,
    sourceEnv: string,
    targetEnv: string,
    schemaSlugs?: string[],
    userId?: number
  ): Promise<{ syncedCount: number; message: string }> {
    await this.assertProjectExists(projectId);

    const cleanSource = sourceEnv.toLowerCase().trim();
    const cleanTarget = targetEnv.toLowerCase().trim();

    if (cleanSource === cleanTarget) {
      throw new BadRequestError('Source and target environments must be different');
    }

    const { ContentEntry } = await import('../models/content-entry.model');

    const filter: any = {
      projectId,
      environment: cleanSource,
    };
    if (schemaSlugs && schemaSlugs.length > 0) {
      filter.schemaSlug = { in: schemaSlugs.map((s) => s.toLowerCase().trim()) };
    }

    const sourceEntries = await ContentEntry.find(filter).exec();
    if (sourceEntries.length === 0) {
      return { syncedCount: 0, message: `No content entries found in environment '${cleanSource}'` };
    }

    let syncedCount = 0;
    for (const src of sourceEntries) {
      const targetDoc = await ContentEntry.findOneAndUpdate(
        {
          projectId,
          schemaSlug: src.schemaSlug,
          slug: src.slug,
          environment: cleanTarget,
        },
        {
          $set: {
            schemaId: src.schemaId,
            title: src.title,
            status: src.status,
            baseLanguage: src.baseLanguage,
            content: src.content,
            translations: src.translations,
            translationStatuses: src.translationStatuses,
            updatedBy: src.updatedBy || src.createdBy,
          },
          $setOnInsert: {
            createdBy: src.createdBy,
          },
        },
        { upsert: true, new: true }
      );

      if (targetDoc) {
        await ContentAuditService.log({
          projectId,
          schemaSlug: src.schemaSlug,
          contentEntryId: targetDoc._id.toString(),
          environment: cleanTarget,
          action: 'SYNCED',
          userId,
          message: `Synced content entry '${src.title}' from '${cleanSource}' to '${cleanTarget}'`,
          details: { sourceEnv: cleanSource, targetEnv: cleanTarget },
        });
      }
      syncedCount++;
    }

    return {
      syncedCount,
      message: `Successfully synced ${syncedCount} content entries from '${cleanSource}' to '${cleanTarget}'`,
    };
  },

  async getAuditLogs(
    projectId: number,
    schemaSlug: string,
    entryId: string
  ): Promise<any[]> {
    await this.assertProjectExists(projectId);
    return ContentAuditService.listLogsForEntry(projectId, schemaSlug, entryId);
  },
};

