import dotenv from 'dotenv';
import appConfig, { app, logLevel, environment } from './app';
import mysqlConfig, { mysql } from './mysql';
import mongoConfig, { mongo } from './mongo';

dotenv.config();

export { app, mysql, mongo, logLevel, environment };
export { logDir, logIdentifier } from './app';

export default {
  app,
  mysql,
  mongo,
  logLevel
};
