import { Worker, Job } from 'bullmq';
import redisConnectionOptions from '../../../../config/redis';
import { TRANSLATION_QUEUE_NAME } from './translation.queue';
import { TranslationJobInput, TranslationJobOutput } from '../../types/translation.types';
import { createQueueLogger } from '../../../../utils/queue-logger';
import { LLMService } from '../../../llm.service';

const logger = createQueueLogger(TRANSLATION_QUEUE_NAME);

export function createTranslationWorkers(): Worker[] {
  const worker = new Worker<TranslationJobInput, TranslationJobOutput>(
    TRANSLATION_QUEUE_NAME,
    async (job: Job<TranslationJobInput>) => {
      const startTime = Date.now();
      const {
        content,
        targetLang,
        keysToTranslate,
        context = {},
      } = job.data;

      const contentEntryId = context.contentEntryId || (job.data as any).contentEntryId;
      logger.info('Processing generalized translation job', {
        jobId: job.id,
        targetLang,
        contentEntryId,
      });

      let contentToTranslate = content;
      let targetContentEntry: any = null;

      // If tied to a ContentEntry, retrieve and hydrate if content wasn't directly passed
      if (contentEntryId) {
        const { ContentEntry } = await import('../../../../models/content-entry.model');
        targetContentEntry = await ContentEntry.findById(contentEntryId);

        if (!targetContentEntry) {
          logger.error('ContentEntry not found for translation job', { contentEntryId });
          return {
            status: 'failed',
            targetLang,
            error: `ContentEntry '${contentEntryId}' not found`,
            durationMs: Date.now() - startTime,
            completedAt: new Date(),
            context,
          };
        }

        // Set status to processing
        await ContentEntry.findByIdAndUpdate(contentEntryId, {
          $set: {
            [`translationStatuses.${targetLang}`]: {
              status: 'processing',
              updatedAt: new Date(),
            },
          },
        });

        if (!contentToTranslate) {
          contentToTranslate = JSON.parse(JSON.stringify(targetContentEntry.content || {}));
        }
      }

      try {
        let effectiveKeysToTranslate = keysToTranslate;

        // If translating a ContentEntry with a schema, extract localized keys automatically
        if (targetContentEntry && (!effectiveKeysToTranslate || effectiveKeysToTranslate.length === 0)) {
          const { SchemaBlueprint } = await import('../../../../models/schema-blueprint.model');
          const { SchemaValidationService } = await import('../../../schema-validation.service');

          let blueprint: any = null;
          if (targetContentEntry.schemaId) {
            blueprint = await SchemaBlueprint.findById(targetContentEntry.schemaId);
          }
          if (!blueprint && targetContentEntry.schemaSlug) {
            blueprint = await SchemaBlueprint.findOne({
              projectId: targetContentEntry.projectId,
              slug: targetContentEntry.schemaSlug,
            });
          }
          if (!blueprint && targetContentEntry.schemaSlug) {
            const { SchemaBlueprintVersion } = await import('../../../../models/schema-blueprint-version.model');
            blueprint = await SchemaBlueprintVersion.findOne({
              projectId: targetContentEntry.projectId,
              slug: targetContentEntry.schemaSlug,
            }).sort({ versionNumber: -1 });
          }

          if (blueprint?.schemaDefinition) {
            effectiveKeysToTranslate = SchemaValidationService.extractLocalizedKeys(blueprint.schemaDefinition);
          }
        }

        const sourcePayload = contentToTranslate || {};
        const translated = await LLMService.mockTranslate(
          sourcePayload,
          targetLang,
          effectiveKeysToTranslate
        );

        // If linked to ContentEntry, persist to MongoDB
        if (contentEntryId && targetContentEntry) {
          const { ContentEntry } = await import('../../../../models/content-entry.model');
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
              projectId: targetContentEntry.projectId,
              schemaSlug: targetContentEntry.schemaSlug,
              contentEntryId: targetContentEntry._id.toString(),
              environment: targetContentEntry.environment,
              action: 'AI_TRANSLATED',
              message: `AI translation completed for language '${targetLang.toUpperCase()}'`,
              details: { language: targetLang, changedFields: Object.keys(translated || {}) },
            });
          } catch (auditErr) {
            logger.warn('Failed to record audit log for AI translation', { error: auditErr });
          }
        }

        const durationMs = Date.now() - startTime;
        logger.info('Generalized translation job completed successfully', {
          jobId: job.id,
          targetLang,
          durationMs,
        });

        return {
          status: 'completed',
          targetLang,
          translatedContent: translated,
          translatedKeys: Object.keys(translated || {}),
          durationMs,
          completedAt: new Date(),
          context,
        };
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        logger.error('Generalized translation job failed', {
          jobId: job.id,
          targetLang,
          error: err.message,
          durationMs,
        });

        if (contentEntryId) {
          const { ContentEntry } = await import('../../../../models/content-entry.model');
          await ContentEntry.findByIdAndUpdate(contentEntryId, {
            $set: {
              [`translationStatuses.${targetLang}`]: {
                status: 'failed',
                error: err.message,
                updatedAt: new Date(),
              },
            },
          });
        }

        return {
          status: 'failed',
          targetLang,
          error: err.message,
          durationMs,
          completedAt: new Date(),
          context,
        };
      }
    },
    {
      connection: redisConnectionOptions as any,
      concurrency: 5,
    }
  );

  return [worker];
}
