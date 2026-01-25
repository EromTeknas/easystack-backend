import 'dotenv/config';
import { z } from 'zod';

const AppEnv = z.object({
  ENVIRONMENT: z.enum(['local', 'dev', 'stage', 'prod']).default('local'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info'),
  LOG_DIR: z.string().default('storage/logs'),
  LOG_IDENTIFIER: z.string().default('easystack'),
});

const parsed = AppEnv.parse(process.env);

export const environment = parsed.ENVIRONMENT;

export const app = {
  port: parsed.PORT,
  environment: parsed.ENVIRONMENT,
};

export const logLevel = parsed.LOG_LEVEL;
export const logDir = parsed.LOG_DIR;
export const logIdentifier = parsed.LOG_IDENTIFIER;

export default { app, logLevel, logDir, logIdentifier, environment };
