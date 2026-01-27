/**
 * Database migration runner and tracker
 * Handles executing migrations and tracking their history
 */

import { db } from '../db';
import { Migration } from './types';
import logger from '../utils/logger';

class Migrator {
  private migrations: Map<string, Migration> = new Map();

  /**
   * Register a migration
   */
  register(migration: Migration) {
    this.migrations.set(migration.name, migration);
  }

  /**
   * Initialize migrations table (creates if not exists)
   */
  async initMigrationsTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS _migrations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
      await db.query(createTableSQL);
      logger.info('✅ Migrations table ready');
    } catch (error) {
      logger.error('Failed to initialize migrations table:', error);
      throw error;
    }
  }

  /**
   * Get list of executed migrations
   */
  async getExecutedMigrations(): Promise<string[]> {
    try {
      const [results] = await db.query('SELECT name FROM _migrations ORDER BY executed_at');
      return (results as any[]).map((r) => r.name);
    } catch (error) {
      logger.error('Failed to fetch executed migrations:', error);
      return [];
    }
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const executed = await this.getExecutedMigrations();
    const pending: Migration[] = [];

    for (const [name, migration] of this.migrations) {
      if (!executed.includes(name)) {
        pending.push(migration);
      }
    }

    return pending;
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    await this.initMigrationsTable();

    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      logger.info('✅ Database is up to date. No migrations to run.');
      return;
    }

    logger.info(`Found ${pending.length} pending migration(s)`);

    for (const migration of pending) {
      try {
        logger.info(`▶️  Running migration: ${migration.name}`);
        await migration.up();

        // Record migration as executed
        await db.query('INSERT INTO _migrations (name) VALUES (?)', [migration.name]);
        logger.info(`✅ Completed: ${migration.name}`);
      } catch (error) {
        logger.error(`❌ Failed: ${migration.name}`, error);
        throw new Error(`Migration failed: ${migration.name}`);
      }
    }

    logger.info('✅ All migrations completed successfully');
  }

  /**
   * Rollback last migration
   */
  async rollback() {
    await this.initMigrationsTable();

    const executed = await this.getExecutedMigrations();

    if (executed.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }

    const lastMigrationName = executed[executed.length - 1]!;
    const migration = this.migrations.get(lastMigrationName);

    if (!migration) {
      logger.error(`Migration not found: ${lastMigrationName}`);
      return;
    }

    try {
      logger.info(`▶️  Rolling back: ${lastMigrationName}`);
      await migration.down();
      await db.query('DELETE FROM _migrations WHERE name = ?', [lastMigrationName]);
      logger.info(`✅ Rolled back: ${lastMigrationName}`);
    } catch (error) {
      logger.error(`❌ Rollback failed: ${lastMigrationName}`, error);
      throw error;
    }
  }

  /**
   * Show migration status
   */
  async status() {
    await this.initMigrationsTable();

    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();

    console.log('\n📋 Migration Status\n');
    console.log('Executed:');
    if (executed.length === 0) {
      console.log('  (none)');
    } else {
      executed.forEach((name) => console.log(`  ✅ ${name}`));
    }

    console.log('\nPending:');
    if (pending.length === 0) {
      console.log('  (none - database is up to date)');
    } else {
      pending.forEach((m) => console.log(`  ⏳ ${m.name}`));
    }
    console.log();
  }
}

export default new Migrator();
