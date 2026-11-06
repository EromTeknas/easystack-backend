import { Worker } from 'bullmq';
import redisConnectionOptions from '../../../../config/redis';
import { TRANSLATION_QUEUE_NAME } from './translation.queue';
import { createQueueLogger } from '../../../../utils/queue-logger';
import { FeedLocalization } from '../../../../models/feed-localization.model';
import { FeedVersion } from '../../../../models/feed-version.model';
import { FeedAuditLog } from '../../../../models/feed-audit-log.model';
import { LLMService, TransientLLMError } from '../../../llm.service';

const logger = createQueueLogger(TRANSLATION_QUEUE_NAME);

export function createTranslationWorkers(): Worker[] {
  const worker = new Worker(
    TRANSLATION_QUEUE_NAME,
    async (job) => {
      // ContentEntry Translation Branch
      if (job.data.contentEntryId) {
        const { contentEntryId, targetLang } = job.data;
        logger.info(`Processing ContentEntry translation job`, { jobId: job.id, contentEntryId, targetLang });

        const { ContentEntry } = await import('../../../../models/content-entry.model');
        const { SchemaBlueprint } = await import('../../../../models/schema-blueprint.model');
        const { FeedSchemaValidationService } = await import('../../../feed-schema-validation.service');

        const entry = await ContentEntry.findById(contentEntryId);
        if (!entry) {
          logger.error(`ContentEntry not found`, { contentEntryId });
          return { status: 'failed', error: 'ContentEntry not found' };
        }

        await ContentEntry.findByIdAndUpdate(contentEntryId, {
          $set: {
            [`translationStatuses.${targetLang}`]: {
              status: 'processing',
              updatedAt: new Date(),
            },
          },
        });

        try {
          let blueprint: any = null;
          if (entry.schemaId) {
            blueprint = await SchemaBlueprint.findById(entry.schemaId);
          }
          if (!blueprint && entry.schemaSlug) {
            blueprint = await SchemaBlueprint.findOne({
              projectId: entry.projectId,
              slug: entry.schemaSlug,
            });
          }
          if (!blueprint && entry.schemaSlug) {
            const { SchemaBlueprintVersion } = await import('../../../../models/schema-blueprint-version.model');
            const verDoc = await SchemaBlueprintVersion.findOne({
              projectId: entry.projectId,
              slug: entry.schemaSlug,
            }).sort({ versionNumber: -1 });
            if (verDoc) blueprint = verDoc;
          }

          let localizedKeys: string[] = [];
          if (blueprint && blueprint.schemaDefinition) {
            localizedKeys = FeedSchemaValidationService.extractLocalizedKeys(blueprint.schemaDefinition);
          }

          const baseContent = JSON.parse(JSON.stringify(entry.content || {}));
          const translated = await LLMService.mockTranslate(baseContent, targetLang, localizedKeys);

          await ContentEntry.findByIdAndUpdate(contentEntryId, {
            $set: {
              [`translations.${targetLang}`]: translated,
              [`translationStatuses.${targetLang}`]: {
                status: 'completed',
                outdatedFields: [],
                updatedAt: new Date(),
              },
            },
          });

          try {
            const { ContentAuditService } = await import('../../../content-audit.service');
            await ContentAuditService.log({
              projectId: entry.projectId,
              schemaSlug: entry.schemaSlug,
              contentEntryId: entry._id.toString(),
              environment: entry.environment,
              action: 'AI_TRANSLATED',
              message: `AI translation completed for language '${targetLang.toUpperCase()}'`,
              details: { language: targetLang, changedFields: Object.keys(translated || {}) },
            });
          } catch (auditErr) {
            logger.warn('Failed to record audit log for AI translation', { error: auditErr });
          }

          logger.info(`ContentEntry translation completed`, { contentEntryId, targetLang });
          return { status: 'completed' };
        } catch (err: any) {
          logger.error(`ContentEntry translation failed`, { contentEntryId, targetLang, error: err.message });
          await ContentEntry.findByIdAndUpdate(contentEntryId, {
            $set: {
              [`translationStatuses.${targetLang}`]: {
                status: 'failed',
                error: err.message,
                updatedAt: new Date(),
              },
            },
          });
          return { status: 'failed', error: err.message };
        }
      }

      const { localizationId, feedVersionId, targetLang, selectedKeys, userId } = job.data;
      
      logger.info(`Processing translation job`, { jobId: job.id, localizationId, targetLang });

      // 1. Fetch Localization
      const localization = await FeedLocalization.findById(localizationId);
      if (!localization) {
        logger.error(`Localization not found`, { localizationId });
        throw new Error('Localization not found');
      }

      // 2. Idempotency Check
      if (localization.status === 'COMPLETED') {
        logger.info(`Localization already completed, skipping`, { localizationId });
        return { status: 'skipped' };
      }

      // 3. Update Status to PROCESSING
      localization.status = 'PROCESSING';
      localization.attempts = (localization.attempts || 0) + 1;
      localization.startedAt = new Date();
      await localization.save();

      try {
        // 4. Fetch Feed Version for Base Content
        const feedVersion = await FeedVersion.findById(feedVersionId).lean();
        if (!feedVersion) {
          throw new Error('FeedVersion not found');
        }

        // 5. Translate (LLM call)
        // Deep merge baseContent with existing localizedContent so we don't wipe out existing translations
        const mergeDeep = (target: any, source: any, currentPath = '') => {
          if (!source) return target;
          for (const key in source) {
            const path = currentPath ? `${currentPath}.${key}` : key;
            const wildcardPath = path.replace(/\.\d+/g, '.*');
            
            const isSelected = selectedKeys && selectedKeys.length > 0 
              ? selectedKeys.some((sk: string) => wildcardPath === sk || wildcardPath.startsWith(sk + '.'))
              : true;

            if (source[key] !== null && typeof source[key] === 'object' && target[key]) {
              mergeDeep(target[key], source[key], path);
            } else {
              // If it's NOT selected for translation, restore the old French translation
              // If it IS selected, we keep the target (English) value so the LLM can translate the new English text
              if (!isSelected) {
                target[key] = source[key];
              }
            }
          }
          return target;
        };
        const baseClone = JSON.parse(JSON.stringify(feedVersion.baseContent));
        const hybridContent = mergeDeep(baseClone, localization.localizedContent || {});
        
        const translatedContent = await LLMService.mockTranslate(hybridContent, targetLang, selectedKeys);

        // 6. Success: Update MongoDB
        localization.status = 'COMPLETED';
        localization.localizedContent = translatedContent;
        localization.completedAt = new Date();
        localization.set('lastError', undefined);
        await localization.save();

        await FeedAuditLog.create({
          feedId: feedVersion.feedId,
          feedVersionId: feedVersion._id,
          userId: userId || -1,
          action: 'GENERATED_TRANSLATION',
          languageCode: targetLang,
          notes: 'Auto-generated by LLM'
        });

        logger.info(`Translation completed successfully`, { localizationId, targetLang });
        return { status: 'completed' };

      } catch (error: any) {
        // Determine if it's transient or permanent
        if (error instanceof TransientLLMError) {
          logger.warn(`Transient error during translation, will retry`, { localizationId, error: error.message });
          // Do NOT update status to FAILED here, just let BullMQ retry it
          throw error; // Let BullMQ retry
        }

        // Permanent Error (e.g. PermanentLLMError, SyntaxError)
        logger.error(`Permanent error during translation`, { localizationId, error: error.message });
        localization.status = 'FAILED';
        localization.lastError = error.message || 'Unknown permanent error';
        await localization.save();
        
        // Do NOT throw error so BullMQ considers the job "done" and stops retrying
        return { status: 'failed_permanently', reason: error.message };
      }
    },
    {
      connection: redisConnectionOptions as any,
      concurrency: 5,
    }
  );

  worker.on('failed', async (job, err) => {
    logger.error(`Job failed`, { jobId: job?.id, error: err.message });
    
    // If we've exhausted all retries and it's a transient error, mark it as FAILED in DB
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      try {
        const loc = await FeedLocalization.findById(job.data.localizationId);
        if (loc && loc.status !== 'FAILED' && loc.status !== 'COMPLETED') {
          loc.status = 'FAILED';
          loc.lastError = `Max retries exhausted: ${err.message}`;
          await loc.save();
          logger.error(`Max retries exhausted, marked as FAILED in DB`, { localizationId: job.data.localizationId });
        }
      } catch (dbErr) {
        logger.error(`Failed to update DB on max retries exhaustion`, { error: dbErr });
      }
    }
  });

  // Initiate auto-healing for any orphaned processing statuses from prior crashed worker sessions
  void autoHealStaleTranslations();

  return [worker];
}

async function autoHealStaleTranslations(): Promise<void> {
  try {
    const { ContentEntry } = await import('../../../../models/content-entry.model');
    const staleThreshold = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
    const staleEntries = await ContentEntry.find({
      $or: [
        { 'translationStatuses.fr.status': { $in: ['processing', 'pending'] } },
        { 'translationStatuses.es.status': { $in: ['processing', 'pending'] } },
        { 'translationStatuses.de.status': { $in: ['processing', 'pending'] } },
        { 'translationStatuses.it.status': { $in: ['processing', 'pending'] } },
        { 'translationStatuses.pt.status': { $in: ['processing', 'pending'] } },
      ],
    });

    for (const entry of staleEntries) {
      let changed = false;
      const statuses = (entry.translationStatuses as Record<string, any>) || {};
      for (const [lang, statusObj] of Object.entries(statuses)) {
        if (
          statusObj &&
          (statusObj.status === 'processing' || statusObj.status === 'pending') &&
          (!statusObj.updatedAt || new Date(statusObj.updatedAt) < staleThreshold)
        ) {
          statuses[lang] = {
            status: 'failed',
            error: 'Translation job timed out or worker was restarted',
            updatedAt: new Date(),
          };
          changed = true;
        }
      }
      if (changed) {
        await ContentEntry.findByIdAndUpdate(entry._id, { $set: { translationStatuses: statuses } });
        logger.info(`Auto-healed stale translation statuses for entry`, { entryId: entry._id.toString() });
      }
    }
  } catch (err) {
    logger.warn('Failed auto-healing stale translations', { error: err });
  }
}

