import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { mysql } from '../config';

// Single PrismaClient instance for the whole app, sharing MySQL config
const mysqlUrl = `mysql://${encodeURIComponent(mysql.user)}:${encodeURIComponent(mysql.password)}@${mysql.host}:${mysql.port}/${mysql.database}`;

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: mysqlUrl
    }
  }
});

export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Prisma connected to MySQL');
  } catch (error) {
    logger.error('Failed to connect Prisma to MySQL', { error });
    throw error;
  }
}

export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch (error) {
    logger.error('Failed to disconnect Prisma from MySQL', { error });
  }
}
