import { env } from "./env";

export const mysql = {
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT,
  user: env.MYSQL_APP_USER || env.MYSQL_USER,
  password: env.MYSQL_APP_PASSWORD || env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE,
};

export default mysql;
