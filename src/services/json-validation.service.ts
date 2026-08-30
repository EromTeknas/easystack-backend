import { BadRequestError } from '../errors/AppError';

export class JsonValidationError extends BadRequestError {
  constructor(message: string) {
    super(message);
    this.name = 'JsonValidationError';
  }
}

export const JsonValidationService = {
  /**
   * Main entry point to validate JSON content and optionally check selectedKeys.
   */
  validate(content: any, selectedKeys?: string[]) {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      throw new JsonValidationError('Root of JSON content must be an object.');
    }

    this.checkDepthAndRules(content, 0);

    if (selectedKeys && selectedKeys.length > 0) {
      this.validateSelectedKeys(content, selectedKeys);
    }

    return true;
  },

  /**
   * Recursively checks depth, empty keys, and array homogeneity.
   */
  checkDepthAndRules(value: any, depth: number, currentPath: string = 'root') {
    if (depth > 10) {
      throw new JsonValidationError(`JSON is too deeply nested at '${currentPath}'. Maximum allowed depth is 10.`);
    }

    if (value === null || typeof value !== 'object') {
      return; // Primitives are fine
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        // Rule: Array Homogeneity
        const firstElementType = this.getTypeCategory(value[0]);
        
        if (firstElementType === 'array') {
          throw new JsonValidationError(`Arrays cannot contain arrays (2D arrays are not allowed) at '${currentPath}'.`);
        }

        const firstElementShape = firstElementType === 'object' ? this.getObjectShape(value[0]) : null;

        for (let i = 1; i < value.length; i++) {
          const item = value[i];
          const itemType = this.getTypeCategory(item);

          if (itemType !== firstElementType) {
            throw new JsonValidationError(`Mixed types in array at '${currentPath}'. Expected '${firstElementType}', found '${itemType}' at index ${i}.`);
          }

          if (itemType === 'object') {
            const itemShape = this.getObjectShape(item);
            if (!this.compareShapes(firstElementShape!, itemShape)) {
              throw new JsonValidationError(`Inconsistent object shapes in array at '${currentPath}'. Object at index ${i} has different keys than the first object.`);
            }
          }
        }

        // Recurse into array items
        for (let i = 0; i < value.length; i++) {
          this.checkDepthAndRules(value[i], depth + 1, `${currentPath}[${i}]`);
        }
      }
    } else {
      // It's an Object
      const keys = Object.keys(value);
      if (keys.length === 0 && depth === 0) {
        throw new JsonValidationError('Root JSON object cannot be empty.');
      }

      for (const key of keys) {
        if (!key.trim()) {
          throw new JsonValidationError(`Empty or whitespace-only keys are not allowed (found at '${currentPath}').`);
        }
        if (key.includes('.')) {
          throw new JsonValidationError(`Keys cannot contain dot notation ('.') characters to prevent path resolution issues. Found key: '${key}' at '${currentPath}'.`);
        }

        this.checkDepthAndRules(value[key], depth + 1, currentPath === 'root' ? key : `${currentPath}.${key}`);
      }
    }
  },

  /**
   * Validates that all selectedKeys actually exist in the JSON using '*' wildcard logic.
   */
  validateSelectedKeys(content: any, selectedKeys: string[]) {
    // Generate all possible valid generic paths using '*' for arrays
    const validPaths = new Set<string>();
    
    const traversePaths = (obj: any, currentPath: string = '') => {
      if (obj === null || typeof obj !== 'object') {
        if (currentPath) validPaths.add(currentPath);
        return;
      }
      
      if (Array.isArray(obj)) {
        if (currentPath) validPaths.add(currentPath); // The array itself is a valid path
        if (obj.length > 0) {
          const arrayWildcardPath = currentPath ? `${currentPath}.*` : '*';
          validPaths.add(arrayWildcardPath);
          traversePaths(obj[0], arrayWildcardPath); 
        }
      } else {
        if (currentPath) validPaths.add(currentPath); // Intermediate object paths are also valid
        for (const key in obj) {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          traversePaths(obj[key], newPath);
        }
      }
    };

    traversePaths(content);

    // Check if each selectedKey is a valid path or prefix of a valid path
    for (const sk of selectedKeys) {
      let isValid = false;
      for (const vp of validPaths) {
        if (vp === sk || vp.startsWith(`${sk}.`)) {
          isValid = true;
          break;
        }
      }
      if (!isValid) {
        throw new JsonValidationError(`Selected key '${sk}' does not match any valid path in the provided JSON schema.`);
      }
    }
  },

  getTypeCategory(val: any): string {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    return typeof val;
  },

  getObjectShape(obj: Record<string, any>): string[] {
    return Object.keys(obj).sort();
  },

  
  /**
   * Deeply compares two JSON objects to ensure their structure (keys and value types) match exactly.
   */
  validateStructureMatch(baseContent: any, targetContent: any, currentPath: string = 'root') {
    const baseType = this.getTypeCategory(baseContent);
    const targetType = this.getTypeCategory(targetContent);

    if (baseType !== targetType) {
      throw new JsonValidationError(`Type mismatch at '${currentPath}': Expected '${baseType}', got '${targetType}'.`);
    }

    if (baseType === 'object') {
      const baseKeys = Object.keys(baseContent).sort();
      const targetKeys = Object.keys(targetContent).sort();

      if (!this.compareShapes(baseKeys, targetKeys)) {
        throw new JsonValidationError(`Structure mismatch at '${currentPath}': Keys do not match. Expected [${baseKeys.join(', ')}], got [${targetKeys.join(', ')}].`);
      }

      for (const key of baseKeys) {
        this.validateStructureMatch(baseContent[key], targetContent[key], `${currentPath}.${key}`);
      }
    } else if (baseType === 'array') {
      if (baseContent.length !== targetContent.length) {
        throw new JsonValidationError(`Array length mismatch at '${currentPath}': Expected ${baseContent.length}, got ${targetContent.length}.`);
      }
      for (let i = 0; i < baseContent.length; i++) {
        this.validateStructureMatch(baseContent[i], targetContent[i], `${currentPath}[${i}]`);
      }
    }
  },

  compareShapes(shape1: string[], shape2: string[]): boolean {
    if (shape1.length !== shape2.length) return false;
    for (let i = 0; i < shape1.length; i++) {
      if (shape1[i] !== shape2[i]) return false;
    }
    return true;
  }
};
