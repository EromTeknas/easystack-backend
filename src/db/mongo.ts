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
