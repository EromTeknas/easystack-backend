/**
 * Migration: Create authentication schema
 * 
 * Creates tables for:
 * - users: User accounts with credentials and roles
 * - refresh_tokens: Refresh token storage with revocation tracking
 * - audit_logs: User action audit trail
 */

import { db } from '../db';
import { Migration } from './types';

export const authSchemaMigration: Migration = {
  name: '001-auth-schema',

  async up() {
    // Create users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role ENUM('USER', 'ADMIN', 'MODERATOR') DEFAULT 'USER',
        status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
        email_verified BOOLEAN DEFAULT FALSE,
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        
        INDEX idx_email (email),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

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
  },

  async down() {
    // Drop tables in reverse order (respecting foreign keys)
    await db.query('DROP TABLE IF EXISTS audit_logs');
    await db.query('DROP TABLE IF EXISTS refresh_tokens');
    await db.query('DROP TABLE IF EXISTS users');
  }
};
