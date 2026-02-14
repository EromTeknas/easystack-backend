#!/usr/bin/env ts-node

/**
 * Cleanup job: expire users stuck in PENDING_VERIFICATION
 *
 * Marks users as EXPIRED if they have not verified their email
 * within the configured time window.
 */

import 'dotenv/config';
import { prisma } from '../db';
import logger from '../utils/logger';

const EXPIRY_HOURS = parseInt(process.env.PENDING_USER_EXPIRY_HOURS || '48', 10);

async function main() {
  try {
    logger.info('Starting cleanup of pending verification users', {
      expiryHours: EXPIRY_HOURS
    });

    const cutoff = new Date(Date.now() - EXPIRY_HOURS * 60 * 60 * 1000);

    const result = await prisma.user.updateMany({
      where: {
        emailVerified: false,
        status: 'PENDING_VERIFICATION',
        createdAt: {
          lt: cutoff
        }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    const affected = result.count ?? 0;

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
