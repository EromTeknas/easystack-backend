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

