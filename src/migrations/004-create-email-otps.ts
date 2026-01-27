/**
 * Migration: Create email_otps table
 * Handles email verification OTPs for user registration
 */

import { db } from '../db';
import logger from '../utils/logger';
import { Migration } from './types';

const migration: Migration = {
  name: '006-email-otps',
  
  async up() {
    const createEmailOtpsSQL = `
      CREATE TABLE IF NOT EXISTS email_otps (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id BIGINT NOT NULL,
        otp_code_hash VARCHAR(255) NOT NULL,
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 5,
        expires_at TIMESTAMP NOT NULL,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
      // Temporarily disable foreign key checks to allow table recreation
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // Drop table if exists to make migration idempotent
      await db.query('DROP TABLE IF EXISTS email_otps');
      
      // Re-enable foreign key checks
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
      
      await db.query(createEmailOtpsSQL);
      logger.info('✅ Created email_otps table');
    } catch (error) {
      logger.error('Failed to create email_otps table:', error);
      throw error;
    }
  },

  async down() {
    try {
      // Temporarily disable foreign key checks to allow table drop
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      await db.query('DROP TABLE IF EXISTS email_otps');
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
      logger.info('✅ Dropped email_otps table');
    } catch (error) {
      logger.error('Failed to drop email_otps table:', error);
      throw error;
    }
  }
};

export default migration;
