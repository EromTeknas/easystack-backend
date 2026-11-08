import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { deliveryPort } from './config/app';
import logger from './utils/logger';
import { initDatabases } from './db/index';
import { prisma } from './db/prisma';
import { redisClient } from './db/redis';
import { requestIdMiddleware } from './delivery/middlewares/request-id.middleware';
import {
  deliveryErrorMiddleware,
  deliveryNotFoundMiddleware,
} from './delivery/middlewares/delivery-error.middleware';
import deliveryRouter from './delivery/routes/index';

async function startDeliveryServer() {
  try {
    logger.info('Initializing delivery service databases...');
    await initDatabases();

    const app = express();

    // Standard Delivery API middleware
    app.use(cors());
    app.use(express.json());
    app.use(requestIdMiddleware);

    // Unauthenticated health check for container liveness probes
    app.get('/health', (_req, res) => {
      res.status(200).json({
        status: 'healthy',
        service: 'easystack-delivery-api',
        timestamp: new Date().toISOString(),
      });
    });

    // Unauthenticated readiness probe for dependency health verification
    app.get('/ready', async (_req, res) => {
      const checks: Record<string, 'up' | 'down'> = {
        redis: 'down',
        mysql: 'down',
        mongodb: 'down',
      };

      try {
        const ping = await redisClient.ping();
        if (ping === 'PONG') {
          checks.redis = 'up';
        }
      } catch {}

      try {
        await prisma.$queryRaw`SELECT 1`;
        checks.mysql = 'up';
      } catch {}

      try {
        if (mongoose.connection.readyState === 1) {
          checks.mongodb = 'up';
        }
      } catch {}

      const allUp = checks.redis === 'up' && checks.mysql === 'up' && checks.mongodb === 'up';
      const statusCode = allUp ? 200 : 503;

      res.status(statusCode).json({
        status: allUp ? 'ready' : 'unhealthy',
        service: 'easystack-delivery-api',
        checks,
        timestamp: new Date().toISOString(),
      });
    });

    // Mount V1 Delivery Routes
    app.use('/v1', deliveryRouter);

    // 404 handler for unknown routes
    app.use(deliveryNotFoundMiddleware);

    // Uniform Delivery Error Handler
    app.use(deliveryErrorMiddleware);

    const port = deliveryPort || 3005;
    app.listen(port, () => {
      logger.info(`EasyStack Delivery API listening on port ${port}`);
    });
  } catch (error) {
    logger.error(`Delivery API startup failed: ${String(error)}`);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error(`[Delivery API] Unhandled Rejection: ${String(reason)}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`[Delivery API] Uncaught Exception: ${String(err)}`);
  process.exit(1);
});

startDeliveryServer();
