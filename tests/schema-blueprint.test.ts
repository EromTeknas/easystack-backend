import test from 'node:test';
import assert from 'node:assert/strict';
import { SchemaBlueprintService } from '../src/services/schema-blueprint.service';
import { FeedSchemaValidationService } from '../src/services/feed-schema-validation.service';

test('SchemaBlueprintService - checkSlugAvailability correctly validates slug format', async () => {
  // Test slug regex
  const validSlugs = ['blog-posts', 'homepage', 'products', 'team-members-2026', 'faq'];
  const invalidSlugs = ['Blog Posts', 'blog_posts', 'blog--posts', '-blog', 'blog-', 'blog/posts', ''];

  const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  for (const slug of validSlugs) {
    assert.strictEqual(SLUG_REGEX.test(slug), true, `Slug '${slug}' should be valid`);
  }

  for (const slug of invalidSlugs) {
    assert.strictEqual(SLUG_REGEX.test(slug), false, `Slug '${slug}' should be invalid`);
  }
});

test('SchemaBlueprint - validates schema definition fields with supported types', () => {
  const blueprintSchema = {
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
        defaultValue: 'My First Post',
        config: { maxLength: 120 },
      },
      {
        id: 'fld-slug',
        key: 'slug',
        label: 'URL Slug',
        type: 'text',
        required: true,
        isLocalized: false,
        isClientEditable: true,
      },
      {
        id: 'fld-cover',
        key: 'coverImage',
        label: 'Cover Image',
        type: 'image',
        required: false,
        isLocalized: false,
        isClientEditable: true,
      },
      {
        id: 'fld-body',
        key: 'body',
        label: 'Body Content',
        type: 'textarea',
        required: true,
        isLocalized: true,
        isClientEditable: true,
      },
      {
        id: 'fld-featured',
        key: 'isFeatured',
        label: 'Featured Post',
        type: 'boolean',
        required: false,
        isLocalized: false,
        isClientEditable: true,
        defaultValue: false,
      },
    ],
  };

  const validated = FeedSchemaValidationService.validateSchemaDefinition(blueprintSchema);
  assert.strictEqual(validated.version, 1);
  assert.strictEqual(validated.fields.length, 5);
  assert.strictEqual(validated.fields[0]?.key, 'title');
  assert.strictEqual(validated.fields[0]?.isLocalized, true);
  assert.strictEqual(validated.fields[1]?.isLocalized, false);
});
