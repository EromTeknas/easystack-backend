export interface SchemaFieldDefinition {
  id: string;
  key: string;
  type: string;
  label: string;
  description?: string;
  required: boolean;
  isLocalized: boolean;
  isClientEditable: boolean;
  defaultValue?: any;
  config?: Record<string, any>;
}

export interface SchemaDefinition {
  version: number;
  fields: SchemaFieldDefinition[];
}
