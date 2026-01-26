import express from 'express';
import { app as appConfig } from './config/index';
import logger from './utils/logger';
import requestContextMiddleware from './middlewares/request-context.middleware';
import { errorHandlerMiddleware, notFoundMiddleware } from './middlewares/error-handler.middleware';
import { initDatabases } from './db/index';
import router from './routes/index';

async function start() {
  try {
    await initDatabases();

    const app = express();

    // Request context middleware (must be first)
    app.use(requestContextMiddleware);

    // Routes
    app.use('/api', router);

    // 404 handler (must be after all routes)
    app.use(notFoundMiddleware);

    // Error handler (must be last)
    app.use(errorHandlerMiddleware);

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
