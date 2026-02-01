#!/usr/bin/env ts-node

/**
 * Cleanup job: expire users stuck in PENDING_VERIFICATION
 *
 * Marks users as EXPIRED if they have not verified their email
 * within the configured time window.
 */

import 'dotenv/config';
import { db } from '../db';
import logger from '../utils/logger';

const EXPIRY_HOURS = parseInt(process.env.PENDING_USER_EXPIRY_HOURS || '48', 10);

async function main() {
  try {
    logger.info('Starting cleanup of pending verification users', {
      expiryHours: EXPIRY_HOURS
    });

    const [result] = await db.query(
      `UPDATE users
       SET status = 'EXPIRED'
       WHERE email_verified = FALSE
         AND status = 'PENDING_VERIFICATION'
         AND created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
      [EXPIRY_HOURS]
    );

    const affected = (result as any).affectedRows ?? 0;

    logger.info('Cleanup completed: expired pending users', {
      affectedRows: affected
    });

    process.exit(0);
  } catch (error) {
    logger.error('Cleanup of pending users failed:', error);
    process.exit(1);
  }
}

main();
