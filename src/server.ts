import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { app as appConfig, corsConfig } from './config/index';
import logger from './utils/logger';
import requestContextMiddleware from './middlewares/request-context.middleware';
import { errorHandlerMiddleware, notFoundMiddleware } from './middlewares/error-handler.middleware';
import { initDatabases } from './db/index';
import router from './routes/index';
import { requestLogger } from './middlewares/request-logger.middleware';
import { delayMiddleware } from './middlewares/delay.middleware';

async function start() {
  try {
    await initDatabases();

    const app = express();

    // CORS configuration
    app.use(cors(corsConfig.options));

    // Body parser middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Cookie parser middleware (for refresh token cookie)
    app.use(cookieParser());

    // Request context middleware (must be after cookie parser)
    app.use(requestContextMiddleware);

    // Register after the body parser so req.body is available
    app.use(requestLogger);
    
    // Artificial delay for local testing (if configured)
    app.use(delayMiddleware);

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
