import test from "node:test";
import assert from "node:assert/strict";
import {
  FeedSchemaValidationService,
  FeedSchemaValidationError,
} from "../src/services/feed-schema-validation.service";

test("FeedSchemaValidationService - validates a valid schema definition", () => {
  const validSchema = {
    version: 1,
    fields: [
      {
        id: "fld-1",
        key: "title",
        label: "Title",
        type: "text",
        required: true,
        isLocalized: true,
        isClientEditable: true,
        config: { minLength: 2, maxLength: 100 },
      },
      {
        id: "fld-2",
        key: "price",
        label: "Price",
        type: "number",
        required: true,
        isLocalized: false,
        isClientEditable: true,
        config: { min: 0 },
      },
      {
        id: "fld-3",
        key: "author",
        label: "Author",
        type: "object",
        required: false,
        isLocalized: false,
        isClientEditable: true,
        config: {
          fields: [
            {
              id: "fld-3-1",
              key: "name",
              label: "Name",
              type: "text",
              required: true,
              isLocalized: true,
              isClientEditable: true,
            },
          ],
        },
      },
      {
        id: "fld-4",
        key: "tags",
        label: "Tags",
        type: "list",
        required: false,
        isLocalized: false,
        isClientEditable: true,
        config: {
          itemDefinition: {
            id: "fld-4-item",
            key: "tag",
            label: "Tag Item",
            type: "text",
            required: true,
            isLocalized: false,
            isClientEditable: true,
          },
        },
      },
    ],
  };

  const validated = FeedSchemaValidationService.validateSchemaDefinition(validSchema);
  assert.equal(validated.version, 1);
  assert.equal(validated.fields.length, 4);
});

test("FeedSchemaValidationService - detects duplicate keys in schema", () => {
  const invalidSchema = {
    version: 1,
    fields: [
      {
        id: "1",
        key: "title",
        label: "Title",
        type: "text",
        required: true,
        isLocalized: true,
        isClientEditable: true,
      },
      {
        id: "2",
        key: "title",
        label: "Duplicate Title",
        type: "text",
        required: false,
        isLocalized: false,
        isClientEditable: true,
      },
    ],
  };

  assert.throws(
    () => FeedSchemaValidationService.validateSchemaDefinition(invalidSchema),
    /Duplicate key 'title'/
  );
});

test("FeedSchemaValidationService - extracts localized keys accurately", () => {
  const schema = {
    version: 1,
    fields: [
      {
        id: "1",
        key: "title",
        label: "Title",
        type: "text",
        required: true,
        isLocalized: true,
        isClientEditable: true,
      },
      {
        id: "2",
        key: "price",
        label: "Price",
        type: "number",
        required: true,
        isLocalized: false,
        isClientEditable: true,
      },
      {
        id: "3",
        key: "author",
        label: "Author",
        type: "object",
        required: true,
        isLocalized: false,
        isClientEditable: true,
        config: {
          fields: [
            {
              id: "3-1",
              key: "bio",
              label: "Bio",
              type: "textarea",
              required: true,
              isLocalized: true,
              isClientEditable: true,
            },
          ],
        },
      },
      {
        id: "4",
        key: "itinerary",
        label: "Itinerary",
        type: "list",
        required: false,
        isLocalized: false,
        isClientEditable: true,
        config: {
          itemDefinition: {
            id: "4-1",
            key: "day",
            label: "Day",
            type: "object",
            required: true,
            isLocalized: false,
            isClientEditable: true,
            config: {
              fields: [
                {
                  id: "4-1-1",
                  key: "description",
                  label: "Description",
                  type: "text",
                  required: true,
                  isLocalized: true,
                  isClientEditable: true,
                },
              ],
            },
          },
        },
      },
    ],
  };

  const localizedKeys = FeedSchemaValidationService.extractLocalizedKeys(schema);
  assert.deepEqual(localizedKeys, ["title", "author.bio", "itinerary.*.description"]);
});

test("FeedSchemaValidationService - validates content conforming to schema", () => {
  const schema = {
    version: 1,
    fields: [
      {
        id: "1",
        key: "title",
        label: "Title",
        type: "text",
        required: true,
        isLocalized: true,
        isClientEditable: true,
        config: { minLength: 3 },
      },
      {
        id: "2",
        key: "rating",
        label: "Rating",
        type: "number",
        required: true,
        isLocalized: false,
        isClientEditable: true,
        config: { min: 1, max: 5 },
      },
    ],
  };

  // Valid content
  assert.doesNotThrow(() => {
    FeedSchemaValidationService.validateContentAgainstSchema(
      { title: "Hello World", rating: 4 },
      schema
    );
  });

  // Invalid: missing required rating
  assert.throws(
    () => {
      FeedSchemaValidationService.validateContentAgainstSchema(
        { title: "Hello World" },
        schema
      );
    },
    (err: any) => err.message.includes("Missing required value for 'Rating'")
  );

  // Invalid: rating out of bounds
  assert.throws(
    () => {
      FeedSchemaValidationService.validateContentAgainstSchema(
        { title: "Hello World", rating: 10 },
        schema
      );
    },
    (err: any) => err.message.includes("cannot exceed 5")
  );
});

test("FeedSchemaValidationService - generates default content accurately", () => {
  const schema = {
    version: 1,
    fields: [
      {
        id: "1",
        key: "title",
        label: "Title",
        type: "text",
        required: true,
        isLocalized: true,
        isClientEditable: true,
        defaultValue: "Default Title",
      },
      {
        id: "2",
        key: "published",
        label: "Published",
        type: "boolean",
        required: true,
        isLocalized: false,
        isClientEditable: true,
      },
      {
        id: "3",
        key: "items",
        label: "Items",
        type: "list",
        required: false,
        isLocalized: false,
        isClientEditable: true,
      },
    ],
  };

  const defaultContent = FeedSchemaValidationService.generateDefaultContent(schema);
  assert.deepEqual(defaultContent, {
    title: "Default Title",
    published: false,
    items: [],
  });
});

test("FeedSchemaValidationService - allows saving drafts with empty required fields", () => {
  const schema = {
    version: 1,
    fields: [
      {
        id: "fld-1",
        key: "title",
        label: "Title",
        type: "text",
        required: true,
        isLocalized: true,
        isClientEditable: true,
      },
      {
        id: "fld-2",
        key: "tags_1",
        label: "New Tags / Badges",
        type: "tags",
        required: true,
        isLocalized: false,
        isClientEditable: true,
      },
    ],
  };

  // Draft mode with empty content must pass without throwing
  assert.doesNotThrow(() => {
    FeedSchemaValidationService.validateContentAgainstSchema(
      {},
      schema,
      { isDraft: true }
    );
  });

  // Draft mode with empty tags array must pass without throwing
  assert.doesNotThrow(() => {
    FeedSchemaValidationService.validateContentAgainstSchema(
      { tags_1: [] },
      schema,
      { isDraft: true }
    );
  });

  // Non-draft (publish) mode must throw missing required error
  assert.throws(
    () => {
      FeedSchemaValidationService.validateContentAgainstSchema(
        {},
        schema,
        { isDraft: false }
      );
    },
    /Missing required value for 'Title'/
  );
});

