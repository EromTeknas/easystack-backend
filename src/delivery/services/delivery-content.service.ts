import { PublishedContentRepository, PublishedCollectionQueryOptions } from '../repositories/published-content.repository';
import { DeliveryContext, DeliveryResponse, DeliveryListQueryParams } from '../types/delivery.types';
import { NotFoundError } from '../../errors';
import { IContentEntry } from '../../models/content-entry.model';
import { EnvironmentResolverService } from '../../services/environment-resolver.service';

export const DeliveryContentService = {
  getEnvironmentAliases(envName: string): string[] {
    const clean = envName.toLowerCase().trim();
    if (clean === 'live' || clean === 'production') {
      return ['live', 'production'];
    }
    if (clean === 'dev' || clean === 'development') {
      return ['dev', 'development'];
    }
    return [clean];
  },

  resolveEntryContent(entry: IContentEntry, requestedLocale?: string) {
    const baseLanguage = entry.baseLanguage || 'en';
    const effectiveLocale = (requestedLocale && requestedLocale.trim()) || baseLanguage;

    const baseContent = (entry.publishedContent || entry.content || {}) as Record<string, any>;
    const baseTitle = entry.publishedTitle || entry.title || '';

    let content = { ...baseContent };
    let title = baseTitle;

    // If requested locale differs from base language, merge translations over base
    if (effectiveLocale !== baseLanguage) {
      const allTranslations = (entry.publishedTranslations || entry.translations || {}) as Record<string, any>;
      const localeTranslations = allTranslations[effectiveLocale];
      if (localeTranslations && typeof localeTranslations === 'object') {
        content = {
          ...baseContent,
          ...localeTranslations,
        };
        if (localeTranslations.title && typeof localeTranslations.title === 'string') {
          title = localeTranslations.title;
        }
      }
    }

    return {
      title,
      effectiveLocale,
      baseLanguage,
      content,
      publishedAt: entry.publishedAt || entry.updatedAt || entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  },

  async getBlueprintContent(
    context: DeliveryContext,
    blueprintSlug: string,
    queryParams: DeliveryListQueryParams = {}
  ): Promise<DeliveryResponse<any>> {
    const blueprint = await PublishedContentRepository.findBlueprint(
      context.projectId,
      blueprintSlug
    );

    if (!blueprint) {
      throw new NotFoundError(`Blueprint '${blueprintSlug}' not found in this project`);
    }

    const resolvedEnv = await EnvironmentResolverService.resolve(
      context.projectId,
      context.environmentId || context.environmentName
    );

    // Verify blueprint is deployed to this environment (for non-base authoring environments)
    if (!resolvedEnv.isBaseAuthoring) {
      const envVers = (blueprint.environmentVersions || {}) as Record<string, number>;
      const deployedVer =
        envVers[String(resolvedEnv.id)] ??
        envVers[resolvedEnv.name.toLowerCase()] ??
        envVers[context.environmentName.toLowerCase()] ??
        0;
      if (deployedVer <= 0) {
        throw new NotFoundError(
          `Blueprint '${blueprintSlug}' is not published in environment '${resolvedEnv.displayName || resolvedEnv.name}'`
        );
      }
    }

    const nowIso = new Date().toISOString();
    const envTarget = { environmentId: resolvedEnv.id, environmentName: resolvedEnv.name };

    // 1. Singleton Delivery
    if (blueprint.type === 'singleton') {
      const entry = await PublishedContentRepository.findPublishedSingleton(
        context.projectId,
        blueprintSlug,
        envTarget
      );

      if (!entry) {
        throw new NotFoundError(
          `Singleton entry for '${blueprintSlug}' is not published in environment '${resolvedEnv.displayName || resolvedEnv.name}'`
        );
      }

      const resolved = this.resolveEntryContent(entry, queryParams.locale);

      return {
        data: {
          title: resolved.title,
          content: resolved.content,
          baseLanguage: resolved.baseLanguage,
          publishedAt: resolved.publishedAt,
          updatedAt: resolved.updatedAt,
        },
        meta: {
          project: context.projectName,
          environment: resolvedEnv.name,
          blueprint: blueprint.slug,
          type: 'singleton',
          locale: resolved.effectiveLocale,
          timestamp: nowIso,
        },
      };
    }

    // 2. Collection Delivery (Paginated List)
    const queryOptions: PublishedCollectionQueryOptions = {
      page: queryParams.page ? Number(queryParams.page) : 1,
      limit: queryParams.limit ? Number(queryParams.limit) : 20,
      search: queryParams.search,
      sort: queryParams.sort,
    };

    const result = await PublishedContentRepository.findPublishedCollectionList(
      context.projectId,
      blueprintSlug,
      envTarget,
      queryOptions
    );

    const items = result.entries.map((e) => {
      const resolved = this.resolveEntryContent(e, queryParams.locale);
      return {
        id: e._id.toString(),
        slug: e.slug,
        title: resolved.title,
        content: resolved.content,
        baseLanguage: resolved.baseLanguage,
        publishedAt: resolved.publishedAt,
        updatedAt: resolved.updatedAt,
      };
    });

    const effectiveLocale = queryParams.locale?.trim() || 'en';

    return {
      data: items,
      meta: {
        project: context.projectName,
        environment: resolvedEnv.name,
        blueprint: blueprint.slug,
        type: 'collection',
        locale: effectiveLocale,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasMore: result.hasMore,
        },
        timestamp: nowIso,
      },
    };
  },

  async getCollectionEntry(
    context: DeliveryContext,
    blueprintSlug: string,
    entrySlug: string,
    locale?: string
  ): Promise<DeliveryResponse<any>> {
    const blueprint = await PublishedContentRepository.findBlueprint(
      context.projectId,
      blueprintSlug
    );

    if (!blueprint) {
      throw new NotFoundError(`Blueprint '${blueprintSlug}' not found in this project`);
    }

    const resolvedEnv = await EnvironmentResolverService.resolve(
      context.projectId,
      context.environmentId || context.environmentName
    );

    // Verify blueprint is deployed to this environment (for non-base authoring environments)
    if (!resolvedEnv.isBaseAuthoring) {
      const envVers = (blueprint.environmentVersions || {}) as Record<string, number>;
      const deployedVer =
        envVers[String(resolvedEnv.id)] ??
        envVers[resolvedEnv.name.toLowerCase()] ??
        envVers[context.environmentName.toLowerCase()] ??
        0;
      if (deployedVer <= 0) {
        throw new NotFoundError(
          `Blueprint '${blueprintSlug}' is not published in environment '${resolvedEnv.displayName || resolvedEnv.name}'`
        );
      }
    }

    const envTarget = { environmentId: resolvedEnv.id, environmentName: resolvedEnv.name };

    const entry = await PublishedContentRepository.findPublishedCollectionEntry(
      context.projectId,
      blueprintSlug,
      entrySlug,
      envTarget
    );

    if (!entry) {
      throw new NotFoundError(
        `Entry '${entrySlug}' not found in '${blueprintSlug}' for environment '${resolvedEnv.displayName || resolvedEnv.name}'`
      );
    }

    const resolved = this.resolveEntryContent(entry, locale);
    const nowIso = new Date().toISOString();

    return {
      data: {
        id: entry._id.toString(),
        slug: entry.slug,
        title: resolved.title,
        content: resolved.content,
        baseLanguage: resolved.baseLanguage,
        publishedAt: resolved.publishedAt,
        updatedAt: resolved.updatedAt,
      },
      meta: {
        project: context.projectName,
        environment: resolvedEnv.name,
        blueprint: blueprint.slug,
        type: 'entry',
        locale: resolved.effectiveLocale,
        timestamp: nowIso,
      },
    };
  },
};
