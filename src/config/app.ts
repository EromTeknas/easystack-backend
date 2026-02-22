import 'dotenv/config';
import { z } from 'zod';

const AppEnv = z.object({
  APP_NAME: z.string().default('easystack-backend'),
  ENVIRONMENT: z.enum(['local', 'dev', 'stage', 'prod']).default('local'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info'),
  LOG_DIR: z.string().default('storage/logs'),
  LOG_IDENTIFIER: z.string().default('easystack'),
  BASE_URL: z.string().url().default('http://localhost:3001'),
  PASSWORD_RESET_URL: z.string().url().default('http://localhost:3000/reset-password')
});

const parsed = AppEnv.parse(process.env);


export const app = {
  name: parsed.APP_NAME,
  port: parsed.PORT,
  environment: parsed.ENVIRONMENT,
};


export const environment = parsed.ENVIRONMENT;
export const logLevel = parsed.LOG_LEVEL;
export const logDir = parsed.LOG_DIR;
export const logIdentifier = parsed.LOG_IDENTIFIER;
export const baseUrl = parsed.BASE_URL;
export const passwordResetUrl = parsed.PASSWORD_RESET_URL;

export default { app, logLevel, logDir, logIdentifier, environment, baseUrl, passwordResetUrl };
