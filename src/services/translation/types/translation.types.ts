export type TranslationJobType = 'content_entry' | 'arbitrary_json' | 'text_batch';

export interface TranslationJobContext {
  contentEntryId?: string;
  projectId?: number;
  schemaSlug?: string;
  environment?: string;
  userId?: number;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface TranslationJobInput<T = Record<string, any>> {
  id?: string;
  type?: TranslationJobType;
  sourceLang?: string;
  targetLang: string;
  content: T;
  keysToTranslate?: string[];
  context?: TranslationJobContext;
}

export interface TranslationJobOutput<T = Record<string, any>> {
  status: 'completed' | 'failed';
  targetLang: string;
  translatedContent?: T;
  translatedKeys?: string[];
  error?: string;
  durationMs: number;
  completedAt: Date;
  context?: TranslationJobContext;
}
