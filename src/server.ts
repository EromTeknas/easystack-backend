import express from 'express';
import { app as appConfig } from './config/index';
import logger from './utils/logger';
import requestContextMiddleware from './middlewares/request-context.middleware';
import { initDatabases } from './db/index';

async function start() {
  try {
    await initDatabases();

    const app = express();

    app.use(requestContextMiddleware);
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));

    const port = appConfig.port;
    app.listen(port, () => {
      logger.info(`Server listening on port ${port}`);
    });
  } catch (err) {
    logger.error(`Startup failed: ${String(err)}`);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${String(reason)}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${String(err)}`);
  process.exit(1);
});

start();
