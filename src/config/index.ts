import { app, logLevel, environment } from './app';
import { mysql } from './mysql';
import { mongo } from './mongo';
import { auth } from './auth';
import { s3, storageConfig } from "./storage";
import { corsConfig, applicationOrigins } from "./cors";
import { googleAuthConfig } from "./google-auth";
import { billingConfig } from "./billing";
import { workersConfig } from "./workers";

export { app, mysql, mongo, auth, s3, storageConfig, corsConfig, applicationOrigins, googleAuthConfig, billingConfig, workersConfig, logLevel, environment };
export { logDir, logIdentifier } from './app';

export default {
  app,
  mysql,
  mongo,
  auth,
  s3,
  storage: storageConfig,
  cors: corsConfig,
  logLevel
};
