/**
 * Migration: Create refresh_tokens table
 * 
 * Manages the refresh_tokens table for storing and tracking refresh tokens
 */

import { db } from '../db';
import logger from '../utils/logger';
import { Migration } from './types';

const migration: Migration = {
  name: '002-refresh-tokens',

  async up() {
    try {
      // Temporarily disable foreign key checks to allow table recreation
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // Drop table if exists to make migration idempotent
      await db.query('DROP TABLE IF EXISTS refresh_tokens');
      
      // Re-enable foreign key checks
      await db.query('SET FOREIGN_KEY_CHECKS = 1');

      // Create refresh_tokens table
      await db.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT NOT NULL,
          token_hash VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          revoked_at TIMESTAMP NULL,
          rotated_token_hash VARCHAR(255),
          ip_address VARCHAR(45),
          user_agent VARCHAR(500),
          device_name VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_token_hash (token_hash),
          INDEX idx_expires_at (expires_at),
          INDEX idx_revoked_at (revoked_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      logger.info('✅ Created refresh_tokens table');
    } catch (error) {
      logger.error('Failed to create refresh_tokens table:', error);
      throw error;
    }
  },

  async down() {
    try {
      // Temporarily disable foreign key checks to allow table drop
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      await db.query('DROP TABLE IF EXISTS refresh_tokens');
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
      logger.info('✅ Dropped refresh_tokens table');
    } catch (error) {
      logger.error('Failed to drop refresh_tokens table:', error);
      throw error;
    }
  }
};

export default migration;
