import { BadRequestError } from '../errors/AppError';
import { SchemaDefinition, SchemaFieldDefinition } from '../models/feed-version.model';

export class FeedSchemaValidationError extends BadRequestError {
  constructor(message: string) {
    super(message);
    this.name = 'FeedSchemaValidationError';
  }
}

export const SUPPORTED_COMPONENT_TYPES = [
  'text',
  'textarea',
  'number',
  'boolean',
  'select',
  'date',
  'image',
  'richtext',
  'color',
  'url',
  'tags',
  'object',
  'list'
] as const;

export type SupportedComponentType = typeof SUPPORTED_COMPONENT_TYPES[number];

const VALID_KEY_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const FeedSchemaValidationService = {
  /**
   * Validates the structural integrity and constraints of a SchemaDefinition.
   */
  validateSchemaDefinition(schema: any): SchemaDefinition {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      throw new FeedSchemaValidationError('Schema definition must be a valid JSON object.');
    }

    if (typeof schema.version !== 'number' || schema.version < 1) {
      throw new FeedSchemaValidationError('Schema version must be a positive integer.');
    }

    if (!Array.isArray(schema.fields)) {
      throw new FeedSchemaValidationError("Schema must contain a 'fields' array.");
    }

    this.validateFieldList(schema.fields, 0, 'root');
    return schema as SchemaDefinition;
  },

  /**
   * Recursively validates an array of fields.
   */
  validateFieldList(fields: SchemaFieldDefinition[], depth: number, scopePath: string) {
    if (depth > 10) {
      throw new FeedSchemaValidationError(`Schema is too deeply nested at '${scopePath}'. Maximum nesting depth is 10.`);
    }

    const seenKeys = new Set<string>();

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const fieldPath = `${scopePath}.${field?.key || `index[${i}]`}`;

      if (!field || typeof field !== 'object') {
        throw new FeedSchemaValidationError(`Field at ${fieldPath} must be an object.`);
      }

      if (!field.id || typeof field.id !== 'string') {
        throw new FeedSchemaValidationError(`Field at ${fieldPath} must have a valid string 'id'.`);
      }

      if (!field.key || typeof field.key !== 'string') {
        throw new FeedSchemaValidationError(`Field at ${fieldPath} must have a non-empty 'key'.`);
      }

      if (!VALID_KEY_REGEX.test(field.key)) {
        throw new FeedSchemaValidationError(
          `Invalid key '${field.key}' at ${fieldPath}. Keys must start with a letter or underscore and contain only alphanumeric characters or underscores.`
        );
      }

      if (seenKeys.has(field.key)) {
        throw new FeedSchemaValidationError(`Duplicate key '${field.key}' found within scope '${scopePath}'.`);
      }
      seenKeys.add(field.key);

      if (!field.label || typeof field.label !== 'string' || !field.label.trim()) {
        throw new FeedSchemaValidationError(`Field '${field.key}' at ${fieldPath} must have a non-empty display 'label'.`);
      }

      if (!SUPPORTED_COMPONENT_TYPES.includes(field.type as SupportedComponentType)) {
        throw new FeedSchemaValidationError(
          `Field '${field.key}' has unsupported component type '${field.type}'. Supported types: ${SUPPORTED_COMPONENT_TYPES.join(', ')}`
        );
      }

      if (typeof field.required !== 'boolean') {
        throw new FeedSchemaValidationError(`Field '${field.key}' must define 'required' as a boolean.`);
      }

      if (typeof field.isLocalized !== 'boolean') {
        throw new FeedSchemaValidationError(`Field '${field.key}' must define 'isLocalized' as a boolean.`);
      }

      if (typeof field.isClientEditable !== 'boolean') {
        throw new FeedSchemaValidationError(`Field '${field.key}' must define 'isClientEditable' as a boolean.`);
      }

      // Type-specific validations
      if (field.type === 'object') {
        const childFields = field.config?.fields;
        if (!Array.isArray(childFields)) {
          throw new FeedSchemaValidationError(`Object field '${field.key}' must have 'config.fields' as an array.`);
        }
        this.validateFieldList(childFields, depth + 1, fieldPath);
      } else if (field.type === 'list') {
        const itemDef = field.config?.itemDefinition;
        if (!itemDef || typeof itemDef !== 'object') {
          throw new FeedSchemaValidationError(`List field '${field.key}' must define a valid 'config.itemDefinition'.`);
        }
        // Validate single item definition (wrap in array to reuse logic)
        this.validateFieldList([itemDef], depth + 1, `${fieldPath}[item]`);
      } else if (field.type === 'select') {
        const options = field.config?.options;
        if (options && !Array.isArray(options)) {
          throw new FeedSchemaValidationError(`Select field '${field.key}' options must be an array.`);
        }
      }
    }
  },

  /**
   * Validates runtime content (base or localized) against a SchemaDefinition.
   */
  validateContentAgainstSchema(
    content: any,
    schema: SchemaDefinition,
    options: { isLocalized?: boolean; locale?: string; isDraft?: boolean } = {}
  ) {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      throw new FeedSchemaValidationError('Content payload must be a JSON object.');
    }

    this.validateContentScope(content, schema.fields, 'root', options);
  },

  validateContentScope(
    content: Record<string, any>,
    fields: SchemaFieldDefinition[],
    currentPath: string,
    options: { isLocalized?: boolean; locale?: string; isDraft?: boolean }
  ) {
    for (const field of fields) {
      const fieldPath = currentPath === 'root' ? field.key : `${currentPath}.${field.key}`;
      const val = content[field.key];

      // If evaluating localized content and this field is NOT localized, skip validation
      if (options.isLocalized && !field.isLocalized) {
        continue;
      }

      // Check Required (only enforced when not saving as draft)
      const isEmpty =
        val === undefined ||
        val === null ||
        (typeof val === 'string' && val.trim() === '') ||
        (Array.isArray(val) && val.length === 0);

      if (!options.isDraft && field.required && isEmpty) {
        throw new FeedSchemaValidationError(`Missing required value for '${field.label}' (${fieldPath}).`);
      }

      // If empty, skip further type checks (allows partial drafts or empty optional fields)
      if (isEmpty) {
        continue;
      }

      // Validate based on type
      switch (field.type) {
        case 'text':
        case 'textarea':
        case 'image':
        case 'richtext':
        case 'color':
        case 'url': {
          if (typeof val !== 'string') {
            throw new FeedSchemaValidationError(`Expected text value for '${field.label}' at '${fieldPath}'.`);
          }
          if (!options.isDraft && field.config?.minLength && val.length < field.config.minLength) {
            throw new FeedSchemaValidationError(
              `'${field.label}' (${fieldPath}) must be at least ${field.config.minLength} characters.`
            );
          }
          if (field.config?.maxLength && val.length > field.config.maxLength) {
            throw new FeedSchemaValidationError(
              `'${field.label}' (${fieldPath}) cannot exceed ${field.config.maxLength} characters.`
            );
          }
          if (field.config?.regexPattern) {
            try {
              const regex = new RegExp(field.config.regexPattern);
              if (!regex.test(val)) {
                throw new FeedSchemaValidationError(`'${field.label}' (${fieldPath}) does not match the required pattern.`);
              }
            } catch (err: any) {
              // Ignore invalid regex in user config or pass
            }
          }
          break;
        }

        case 'tags': {
          if (!Array.isArray(val) || val.some((item) => typeof item !== 'string')) {
            throw new FeedSchemaValidationError(`Expected array of strings for '${field.label}' at '${fieldPath}'.`);
          }
          break;
        }

        case 'number': {
          if (typeof val !== 'number' || isNaN(val)) {
            throw new FeedSchemaValidationError(`Expected numeric value for '${field.label}' at '${fieldPath}'.`);
          }
          if (field.config?.min !== undefined && val < field.config.min) {
            throw new FeedSchemaValidationError(
              `'${field.label}' (${fieldPath}) must be greater than or equal to ${field.config.min}.`
            );
          }
          if (field.config?.max !== undefined && val > field.config.max) {
            throw new FeedSchemaValidationError(
              `'${field.label}' (${fieldPath}) cannot exceed ${field.config.max}.`
            );
          }
          break;
        }

        case 'boolean': {
          if (typeof val !== 'boolean') {
            throw new FeedSchemaValidationError(`Expected boolean true/false for '${field.label}' at '${fieldPath}'.`);
          }
          break;
        }

        case 'date': {
          if (typeof val !== 'string' || isNaN(Date.parse(val))) {
            throw new FeedSchemaValidationError(`Expected valid date string for '${field.label}' at '${fieldPath}'.`);
          }
          break;
        }

        case 'select': {
          const allowedValues = (field.config?.options || []).map((opt: any) => opt.value);
          if (field.config?.allowMultiple) {
            if (!Array.isArray(val)) {
              throw new FeedSchemaValidationError(`Expected array of selections for '${field.label}' at '${fieldPath}'.`);
            }
            if (allowedValues.length > 0) {
              for (const item of val) {
                if (!allowedValues.includes(item)) {
                  throw new FeedSchemaValidationError(`Invalid selection '${item}' for '${field.label}' at '${fieldPath}'.`);
                }
              }
            }
          } else {
            if (allowedValues.length > 0 && !allowedValues.includes(val)) {
              throw new FeedSchemaValidationError(`Invalid option '${val}' selected for '${field.label}' at '${fieldPath}'.`);
            }
          }
          break;
        }

        case 'object': {
          if (typeof val !== 'object' || Array.isArray(val)) {
            throw new FeedSchemaValidationError(`Expected object container for '${field.label}' at '${fieldPath}'.`);
          }
          const childFields = field.config?.fields || [];
          this.validateContentScope(val, childFields, fieldPath, options);
          break;
        }

        case 'list': {
          if (!Array.isArray(val)) {
            throw new FeedSchemaValidationError(`Expected list array for '${field.label}' at '${fieldPath}'.`);
          }
          if (!options.isDraft && field.config?.minItems && val.length < field.config.minItems) {
            throw new FeedSchemaValidationError(
              `'${field.label}' (${fieldPath}) requires at least ${field.config.minItems} items.`
            );
          }
          if (field.config?.maxItems && val.length > field.config.maxItems) {
            throw new FeedSchemaValidationError(
              `'${field.label}' (${fieldPath}) cannot have more than ${field.config.maxItems} items.`
            );
          }
          const itemDef = field.config?.itemDefinition;
          if (itemDef) {
            for (let i = 0; i < val.length; i++) {
              const itemVal = val[i];
              if (itemDef.type === 'object') {
                if (typeof itemVal !== 'object' || Array.isArray(itemVal)) {
                  throw new FeedSchemaValidationError(`Item at '${fieldPath}[${i}]' must be an object.`);
                }
                this.validateContentScope(itemVal, itemDef.config?.fields || [], `${fieldPath}[${i}]`, options);
              } else {
                // Primitive item check
                const dummyParent = { [itemDef.key]: itemVal };
                this.validateContentScope(dummyParent, [itemDef], `${fieldPath}[${i}]`, options);
              }
            }
          }
          break;
        }
      }
    }
  },

  /**
   * Generates default content from a SchemaDefinition.
   */
  generateDefaultContent(schema: SchemaDefinition): Record<string, any> {
    const content: Record<string, any> = {};

    for (const field of schema.fields) {
      content[field.key] = this.getDefaultFieldValue(field);
    }

    return content;
  },

  getDefaultFieldValue(field: SchemaFieldDefinition): any {
    if (field.defaultValue !== undefined) {
      return field.defaultValue;
    }

    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'image':
      case 'richtext':
      case 'url':
        return '';
      case 'color':
        return '#000000';
      case 'tags':
        return [];
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'date':
        return new Date().toISOString();
      case 'select':
        return field.config?.allowMultiple ? [] : (field.config?.options?.[0]?.value ?? '');
      case 'object': {
        const obj: Record<string, any> = {};
        for (const child of field.config?.fields || []) {
          obj[child.key] = this.getDefaultFieldValue(child);
        }
        return obj;
      }
      case 'list':
        return [];
      default:
        return '';
    }
  },

  /**
   * Extracts all localized key paths from a SchemaDefinition (using '*' for array items).
   */
  extractLocalizedKeys(schema: SchemaDefinition): string[] {
    const localizedKeys: string[] = [];

    const traverse = (fields: SchemaFieldDefinition[], prefix: string = '') => {
      for (const field of fields) {
        const path = prefix ? `${prefix}.${field.key}` : field.key;
        if (field.isLocalized) {
          localizedKeys.push(path);
        }
        if (field.type === 'object' && field.config?.fields) {
          traverse(field.config.fields, path);
        } else if (field.type === 'list' && field.config?.itemDefinition) {
          const itemDef = field.config.itemDefinition;
          const listWildcardPath = `${path}.*`;
          if (itemDef.isLocalized) {
            localizedKeys.push(listWildcardPath);
          }
          if (itemDef.type === 'object' && itemDef.config?.fields) {
            traverse(itemDef.config.fields, listWildcardPath);
          }
        }
      }
    };

    traverse(schema.fields);
    return localizedKeys;
  }
};
