/**
 * Migration: Create workspace_members table
 * Maps users to workspaces with role-based access control
 */

import { db } from '../db';
import logger from '../utils/logger';
import { Migration } from './types';

const migration: Migration = {
  name: '005-workspace-members',
  
  async up() {
    const createWorkspaceMembersSQL = `
      CREATE TABLE IF NOT EXISTS workspace_members (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        workspace_id VARCHAR(36) NOT NULL,
        user_id BIGINT NOT NULL,
        role ENUM('OWNER', 'ADMIN', 'USER') NOT NULL DEFAULT 'USER',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_workspace_user (workspace_id, user_id),
        INDEX idx_user_id (user_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
      // Temporarily disable foreign key checks to allow table recreation
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // Drop table if exists to make migration idempotent
      await db.query('DROP TABLE IF EXISTS workspace_members');
      
      // Re-enable foreign key checks
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
      
      await db.query(createWorkspaceMembersSQL);
      logger.info('✅ Created workspace_members table');
    } catch (error) {
      logger.error('Failed to create workspace_members table:', error);
      throw error;
    }
  },

  async down() {
    try {
      // Temporarily disable foreign key checks to allow table drop
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      await db.query('DROP TABLE IF EXISTS workspace_members');
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
      logger.info('✅ Dropped workspace_members table');
    } catch (error) {
      logger.error('Failed to drop workspace_members table:', error);
      throw error;
    }
  }
};

export default migration;
