import { db } from '../db';
import logger from '../utils/logger';
import { Migration } from './types';

const migration: Migration = {
  name: '005-update-users-status-enum',

  async up() {
    try {
      // Expand status enum to include verification-related states
      await db.query(`
        ALTER TABLE users
        MODIFY COLUMN status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'EXPIRED')
        DEFAULT 'PENDING_VERIFICATION';
      `);

      // Align existing users with new states
      await db.query(`
        UPDATE users
        SET status = 'ACTIVE'
        WHERE email_verified = TRUE;
      `);

      await db.query(`
        UPDATE users
        SET status = 'PENDING_VERIFICATION'
        WHERE email_verified = FALSE;
      `);

      logger.info('✅ Updated users.status enum and aligned existing records');
    } catch (error) {
      logger.error('Failed to update users.status enum:', error);
      throw error;
    }
  },

  async down() {
    try {
      // Map verification-related states back to generic ACTIVE before shrinking enum
      await db.query(`
        UPDATE users
        SET status = 'ACTIVE'
        WHERE status IN ('PENDING_VERIFICATION', 'EXPIRED');
      `);

      await db.query(`
        ALTER TABLE users
        MODIFY COLUMN status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED')
        DEFAULT 'ACTIVE';
      `);

      logger.info('✅ Reverted users.status enum changes');
    } catch (error) {
      logger.error('Failed to revert users.status enum:', error);
      throw error;
    }
  }
};

export default migration;
