import mongoose from 'mongoose';
import logger from '../utils/logger';
import { mongo as mongoConfig } from '../config/index';

export async function connectMongo() {
  try {
    await mongoose.connect(mongoConfig.uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      retryWrites: false,
    } as mongoose.ConnectOptions);

    logger.info('MongoDB connected');

    try {
      const coll = mongoose.connection.collection('contententries');
      const existingIndexes = await coll.indexes();
      if (existingIndexes.some((idx) => idx.name === 'projectId_1_schemaSlug_1_slug_1')) {
        await coll.dropIndex('projectId_1_schemaSlug_1_slug_1');
        logger.info('Dropped legacy unique index projectId_1_schemaSlug_1_slug_1 from contententries');
      }
      if (existingIndexes.some((idx) => idx.name === 'projectId_1_schemaSlug_1_updatedAt_-1')) {
        await coll.dropIndex('projectId_1_schemaSlug_1_updatedAt_-1');
        logger.info('Dropped legacy index projectId_1_schemaSlug_1_updatedAt_-1 from contententries');
      }
    } catch {
      // Collection may not exist yet on fresh setup
    }

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${String(err)}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (err) {
    logger.error(`MongoDB connection failed: ${String(err)}`);
    throw err;
  }
}

export default mongoose;
