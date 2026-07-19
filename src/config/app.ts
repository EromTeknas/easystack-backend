import { env } from "./env";

export const app = {
  name: env.APP_NAME,
  port: env.PORT,
  environment: env.ENVIRONMENT,
};


export const environment = env.ENVIRONMENT;
export const logLevel = env.LOG_LEVEL;
export const logDir = env.LOG_DIR;
export const logIdentifier = env.LOG_IDENTIFIER;
export const baseUrl = env.BASE_URL;
export const passwordResetUrl = env.PASSWORD_RESET_URL;

export default { app, logLevel, logDir, logIdentifier, environment, baseUrl, passwordResetUrl };
