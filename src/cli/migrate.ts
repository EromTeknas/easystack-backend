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

const command = process.argv[2];

async function main() {
  try {
    switch (command) {
      case 'up':
        await migrator.runMigrations();
        break;

      case 'down':
        await migrator.rollback();
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
  ts-node src/cli/migrate.ts <command>

Commands:
  up       Run all pending migrations
  down     Rollback the last migration
  status   Show migration status

Examples:
  npm run migrate:up      # Run pending migrations
  npm run migrate:down    # Rollback last migration
  npm run migrate:status  # Check status
        `);
        process.exit(0);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Migration error:', error);
    process.exit(1);
  }
}

main();
