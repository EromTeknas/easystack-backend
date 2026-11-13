import { env } from "./env";

const user = env.MYSQL_APP_USER || env.MYSQL_USER;
const password = env.MYSQL_APP_PASSWORD ?? env.MYSQL_PASSWORD;

if (!user) {
  throw new Error("Missing required MySQL user. Set MYSQL_APP_USER or MYSQL_USER in your environment file.");
}
if (password === undefined) {
  throw new Error("Missing required MySQL password. Set MYSQL_APP_PASSWORD or MYSQL_PASSWORD in your environment file.");
}

export const mysql = {
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT,
  user,
  password,
  database: env.MYSQL_DATABASE,
};

export default mysql;
