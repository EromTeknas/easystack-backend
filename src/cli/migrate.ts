#!/usr/bin/env ts-node

/**
 * Database Migration CLI
 * 
 * Usage:
 *   npm run migrate:up      - Run pending migrations
 *   npm run migrate:down    - Rollback last migration
 *   npm run migrate:status  - Show migration status
 * 
 * Example:
 *   npm run migrate:up
 */

import 'dotenv/config';
import migrator from '../migrations';
import logger from '../utils/logger';
import { initDatabases } from '../db';

const command = process.argv[2];

async function main() {
  try {
    // Ensure database connections are initialized before running migrations
    await initDatabases();
    switch (command) {
      case 'up':
        await migrator.runMigrations();
        break;

      case 'down':
        await migrator.rollback();
        break;

      case 'down:all': {
        const preserveData = process.argv.includes('--preserve-data');
        await migrator.downAll(preserveData);
        break;
      }

      case 'status':
        await initDatabases();
        const preserveData = process.argv.includes('--preserve-data');
        switch (command as any) {
          case 'up':
            await migrator.runMigrations();
            break;
          case 'down':
            await migrator.rollback();
            break;
          case 'down:all':
            await migrator.downAll(preserveData);
            break;
          case 'status':
            await migrator.status();
            break;
          default:
            console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║         EasyStack Database Migration CLI                   ║
    ╚════════════════════════════════════════════════════════════╝

    Usage:
      ts-node src/cli/migrate.ts <command> [--preserve-data]

    Commands:
      up           Run all pending migrations
      down         Rollback the last migration
      down:all     Rollback all migrations (use --preserve-data to keep tables)
      status       Show migration status

    Examples:
      npm run migrate:up             # Run pending migrations
      npm run migrate:down           # Rollback last migration
      npm run migrate:down:all       # Rollback all migrations and drop all tables
      npm run migrate:down:all -- --preserve-data  # Remove migration records but keep data
    `);
        }
        break;
    }
  } catch (error) {
    logger.error('Migration command failed:', error);
    process.exit(1);
  }
}

main();
