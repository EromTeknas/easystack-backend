import logger from '../logger';
import { connectMySQL } from './mysql';
import { connectMongo } from './mongo';

export async function initDatabases() {
  logger.info('Initializing databases...');

  await Promise.all([connectMySQL(), connectMongo()]);

  logger.info('All databases initialized');
}

export * from './mysql';
export * from './mongo';