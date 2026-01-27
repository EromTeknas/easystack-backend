/**
 * Migration: Create audit_logs table
 * 
 * Manages the audit_logs table for user action tracking
 */

import { db } from '../db';
import logger from '../utils/logger';
import { Migration } from './types';

const migration: Migration = {
  name: '003-audit-logs',

  async up() {
    try {
      // Temporarily disable foreign key checks to allow table recreation
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // Drop table if exists to make migration idempotent
      await db.query('DROP TABLE IF EXISTS audit_logs');
      
      // Re-enable foreign key checks
      await db.query('SET FOREIGN_KEY_CHECKS = 1');

      // Create audit_logs table
      await db.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT,
          action VARCHAR(100) NOT NULL,
          resource VARCHAR(100),
          ip_address VARCHAR(45),
          user_agent VARCHAR(500),
          status ENUM('SUCCESS', 'FAILURE') DEFAULT 'SUCCESS',
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_user_id (user_id),
          INDEX idx_action (action),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      logger.info('✅ Created audit_logs table');
    } catch (error) {
      logger.error('Failed to create audit_logs table:', error);
      throw error;
    }
  },

  async down() {
    try {
      // Temporarily disable foreign key checks to allow table drop
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      await db.query('DROP TABLE IF EXISTS audit_logs');
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
      logger.info('✅ Dropped audit_logs table');
    } catch (error) {
      logger.error('Failed to drop audit_logs table:', error);
      throw error;
    }
  }
};

export default migration;
