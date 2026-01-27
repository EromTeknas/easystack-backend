/**
 * Migration: Create workspaces table
 * Creates the foundational workspace (tenant) table for multi-tenancy
 */

import { db } from '../db';
import logger from '../utils/logger';
import { Migration } from './types';

const migration: Migration = {
  name: '004-workspaces',
  
  async up() {
    const createWorkspacesSQL = `
      CREATE TABLE IF NOT EXISTS workspaces (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        name VARCHAR(255) NOT NULL,
        logo_url VARCHAR(500),
        created_by BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_created_by (created_by),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
      // Temporarily disable foreign key checks to allow table recreation
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // Drop table if exists to make migration idempotent
      await db.query('DROP TABLE IF EXISTS workspaces');
      
      // Re-enable foreign key checks
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
      
      await db.query(createWorkspacesSQL);
      logger.info('✅ Created workspaces table');
    } catch (error) {
      logger.error('Failed to create workspaces table:', error);
      throw error;
    }
  },

  async down() {
    try {
      // Temporarily disable foreign key checks to allow table drop
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      await db.query('DROP TABLE IF EXISTS workspaces');
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
      logger.info('✅ Dropped workspaces table');
    } catch (error) {
      logger.error('Failed to drop workspaces table:', error);
      throw error;
    }
  }
};

export default migration;
