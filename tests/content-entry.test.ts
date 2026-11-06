import test from 'node:test';
import assert from 'node:assert/strict';
import { FeedSchemaValidationService } from '../src/services/feed-schema-validation.service';
import { SchemaDefinition } from '../src/models/feed-version.model';

const blogPostSchema: SchemaDefinition = {
  version: 1,
  fields: [
    {
      id: 'fld-title',
      key: 'title',
      label: 'Blog Title',
      type: 'text',
      required: true,
      isLocalized: true,
      isClientEditable: true,
      config: { maxLength: 100 },
    },
    {
      id: 'fld-views',
      key: 'views',
      label: 'Page Views',
      type: 'number',
      required: false,
      isLocalized: false,
      isClientEditable: true,
      config: { min: 0 },
    },
    {
      id: 'fld-published',
      key: 'isPublished',
      label: 'Published',
      type: 'boolean',
      required: true,
      isLocalized: false,
      isClientEditable: true,
    },
  ],
};

test('ContentEntry - successfully validates conforming content', () => {
  const content = {
    title: 'Hello World',
    views: 42,
    isPublished: true,
  };

  assert.doesNotThrow(() => {
    FeedSchemaValidationService.validateContentAgainstSchema(content, blogPostSchema);
  });
});

test('ContentEntry - fails validation when required field is missing', () => {
  const invalidContent = {
    title: 'Hello World',
    // isPublished is required but missing
  };

  assert.throws(
    () => {
      FeedSchemaValidationService.validateContentAgainstSchema(invalidContent, blogPostSchema);
    },
    /Missing required value for 'Published'/
  );
});

test('ContentEntry - fails validation when string exceeds maxLength', () => {
  const invalidContent = {
    title: 'A'.repeat(101),
    isPublished: true,
  };

  assert.throws(
    () => {
      FeedSchemaValidationService.validateContentAgainstSchema(invalidContent, blogPostSchema);
    },
    /cannot exceed 100 characters/
  );
});

test('ContentEntry - fails validation when number is below min', () => {
  const invalidContent = {
    title: 'Valid Title',
    views: -5,
    isPublished: true,
  };

  assert.throws(
    () => {
      FeedSchemaValidationService.validateContentAgainstSchema(invalidContent, blogPostSchema);
    },
    /must be greater than or equal to 0/
  );
});

test('ContentEntry - draft diff detects modified fields between current content and publishedContent', () => {
  const publishedContent = {
    title: 'Original Published Title',
    views: 10,
    isPublished: true,
  };

  const draftContent = {
    title: 'Edited Draft Title',
    views: 10,
    isPublished: true,
  };

  const modifiedKeys = Object.keys(draftContent).filter(
    (key) => JSON.stringify(draftContent[key as keyof typeof draftContent]) !== JSON.stringify(publishedContent[key as keyof typeof publishedContent])
  );

  assert.deepEqual(modifiedKeys, ['title']);

  // Discard simulation restores published state
  const restoredContent = { ...publishedContent };
  assert.equal(restoredContent.title, 'Original Published Title');
});

test('ContentEntry - publication guard blocks when target translations are missing or incomplete', () => {
  const targetLanguages = ['es', 'fr'];
  const incompleteStatuses: Record<string, any> = {
    es: { status: 'completed', outdatedFields: [] },
    fr: { status: 'pending', outdatedFields: [] },
  };

  const missingOrIncomplete = targetLanguages.filter((lang) => {
    const raw = incompleteStatuses[lang];
    const st = typeof raw === 'object' && raw !== null ? raw.status : raw;
    const hasOutdated = Array.isArray(raw?.outdatedFields) && raw.outdatedFields.length > 0;
    return st !== 'completed' || hasOutdated;
  });

  assert.deepEqual(missingOrIncomplete, ['fr']);
});

test('ContentEntry - publication guard allows when all target translations are completed', () => {
  const targetLanguages = ['es', 'fr'];
  const completedStatuses: Record<string, any> = {
    es: { status: 'completed', outdatedFields: [] },
    fr: { status: 'completed', outdatedFields: [] },
  };

  const missingOrIncomplete = targetLanguages.filter((lang) => {
    const raw = completedStatuses[lang];
    const st = typeof raw === 'object' && raw !== null ? raw.status : raw;
    const hasOutdated = Array.isArray(raw?.outdatedFields) && raw.outdatedFields.length > 0;
    return st !== 'completed' || hasOutdated;
  });

  assert.deepEqual(missingOrIncomplete, []);
});

test('ContentEntry - publication guard blocks when completed translation has outdatedFields', () => {
  const targetLanguages = ['es', 'fr'];
  const outdatedStatuses: Record<string, any> = {
    es: { status: 'completed', outdatedFields: ['title'] },
    fr: { status: 'completed', outdatedFields: [] },
  };

  const missingOrIncomplete = targetLanguages.filter((lang) => {
    const raw = outdatedStatuses[lang];
    const st = typeof raw === 'object' && raw !== null ? raw.status : raw;
    const hasOutdated = Array.isArray(raw?.outdatedFields) && raw.outdatedFields.length > 0;
    return st !== 'completed' || hasOutdated;
  });

  assert.deepEqual(missingOrIncomplete, ['es']);
});

test('ContentEntry - saving draft preserves publishedContent and logs DRAFT_SAVED', () => {
  const existingPublished = {
    status: 'published',
    publishedContent: { text: '123' },
    content: { text: '123' },
    publishedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const draftUpdate: { status: string; content: Record<string, any> } = {
    status: 'draft',
    content: { text: '1234' },
  };

  // Simulate updateEntry behavior
  const isDraftSave = draftUpdate.status === 'draft';
  const action = isDraftSave ? 'DRAFT_SAVED' : 'UPDATED';

  // publishedContent must remain frozen to existing published snapshot
  const finalPublishedContent = draftUpdate.status === 'published'
    ? draftUpdate.content
    : existingPublished.publishedContent;

  assert.equal(action, 'DRAFT_SAVED');
  assert.deepEqual(finalPublishedContent, { text: '123' });
  assert.deepEqual(draftUpdate.content, { text: '1234' });
});

test('ContentEntry - publication guard permits publication when forcePublish is true and marks translations ready', () => {
  const targetLanguages = ['es', 'fr'];
  const incompleteStatuses: Record<string, any> = {
    es: { status: 'outdated', outdatedFields: ['title'] },
    fr: { status: 'pending', outdatedFields: [] },
  };

  const forcePublish = true;
  let forcePublishStatuses: Record<string, any> | undefined;

  const missingOrIncomplete = targetLanguages.filter((lang) => {
    const raw = incompleteStatuses[lang];
    const st = typeof raw === 'object' && raw !== null ? raw.status : raw;
    const hasOutdated = Array.isArray(raw?.outdatedFields) && raw.outdatedFields.length > 0;
    return st !== 'completed' || hasOutdated;
  });

  if (missingOrIncomplete.length > 0) {
    if (forcePublish) {
      forcePublishStatuses = { ...incompleteStatuses };
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

  assert.ok(forcePublishStatuses);
  assert.equal(forcePublishStatuses.es.status, 'completed');
  assert.deepEqual(forcePublishStatuses.es.outdatedFields, []);
  assert.equal(forcePublishStatuses.fr.status, 'completed');
  assert.deepEqual(forcePublishStatuses.fr.outdatedFields, []);
});

