/**
 * Migration system types and interfaces
 */

export interface Migration {
  name: string;
  up(): Promise<void>;
  down(): Promise<void>;
}

export interface MigrationRecord {
  id: number;
  name: string;
  executed_at: Date;
}
