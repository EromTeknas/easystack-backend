import dotenv from 'dotenv';
import appConfig, { app, logLevel, environment } from './app';
import mysqlConfig, { mysql } from './mysql';
import mongoConfig, { mongo } from './mongo';
import authConfig, { auth } from './auth';

dotenv.config();

export { app, mysql, mongo, auth, logLevel, environment };
export { logDir, logIdentifier } from './app';

export default {
  app,
  mysql,
  mongo,
  auth,
  logLevel
};
