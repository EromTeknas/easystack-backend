import dotenv from 'dotenv';
import appConfig, { app, logLevel, environment } from './app';
import mysqlConfig, { mysql } from './mysql';
import mongoConfig, { mongo } from './mongo';
import authConfig, { auth } from './auth';
import s3Config, { s3 } from './s3';

dotenv.config();

export { app, mysql, mongo, auth, s3, logLevel, environment };
export { logDir, logIdentifier } from './app';

export default {
  app,
  mysql,
  mongo,
  auth,
  s3,
  logLevel
};
