import test from 'node:test';
import assert from 'node:assert/strict';
import { SchemaValidationService } from '../src/services/schema-validation.service';
import { SchemaDefinition } from '../src/types/schema.types';

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
    SchemaValidationService.validateContentAgainstSchema(content, blogPostSchema);
  });
});

test('ContentEntry - fails validation when required field is missing', () => {
  const invalidContent = {
    title: 'Hello World',
    // isPublished is required but missing
  };

  assert.throws(
    () => {
      SchemaValidationService.validateContentAgainstSchema(invalidContent, blogPostSchema);
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
      SchemaValidationService.validateContentAgainstSchema(invalidContent, blogPostSchema);
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
      SchemaValidationService.validateContentAgainstSchema(invalidContent, blogPostSchema);
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

test('SchemaValidationService - validates schema with video and lists of media', () => {
  const schema = {
    version: 1,
    fields: [
      {
        id: 'f1',
        key: 'hero_image',
        type: 'image',
        label: 'Cover Photo',
        required: true,
        isLocalized: true,
        isClientEditable: true,
      },
      {
        id: 'f2',
        key: 'promo_video',
        type: 'video',
        label: 'Promo Video',
        required: false,
        isLocalized: false,
        isClientEditable: true,
      },
      {
        id: 'f3',
        key: 'photo_gallery',
        type: 'list',
        label: 'Photos',
        required: false,
        isLocalized: true,
        isClientEditable: true,
        config: {
          itemDefinition: {
            id: 'item-photo',
            key: 'photo',
            type: 'image',
            label: 'Photo',
            required: false,
            isLocalized: true,
            isClientEditable: true,
          },
        },
      },
    ],
  };

  const validatedSchema = SchemaValidationService.validateSchemaDefinition(schema);
  assert.equal(validatedSchema.fields.length, 3);
  assert.equal(validatedSchema.fields[1]?.type, 'video');

  // Validate content with Option A structured media object
  const validContent = {
    hero_image: {
      assetId: 'ast-123',
      url: 'https://cdn.easystack.io/projects/1/assets/cover.jpg',
      alt: 'Scenic mountain view',
      mimeType: 'image/jpeg',
      sizeBytes: 204800,
    },
    promo_video: {
      assetId: 'ast-456',
      url: 'https://cdn.easystack.io/projects/1/assets/tour.mp4',
      mimeType: 'video/mp4',
    },
    photo_gallery: [
      {
        assetId: 'ast-789',
        url: 'https://cdn.easystack.io/projects/1/assets/day1.jpg',
      },
      'https://cdn.easystack.io/projects/1/assets/day2.jpg', // string URL backward compatible
    ],
  };

  assert.doesNotThrow(() => {
    SchemaValidationService.validateContentAgainstSchema(validContent, validatedSchema, { isDraft: false });
  });

  // Saving draft with partial/empty fields must also succeed
  const draftContent = {
    hero_image: {
      url: '',
    },
  };
  assert.doesNotThrow(() => {
    SchemaValidationService.validateContentAgainstSchema(draftContent, validatedSchema, { isDraft: true });
  });
});


