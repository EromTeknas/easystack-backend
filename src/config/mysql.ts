import 'dotenv/config';
import { z } from 'zod';

const MySQLEnv = z.object({
  MYSQL_HOST: z.string().default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().default(3306),
  // Application user (runtime)
  MYSQL_APP_USER: z.string().optional(),
  MYSQL_APP_PASSWORD: z.string().optional(),
  // Legacy single-user config (fallback for older envs)
  MYSQL_USER: z.string().default('root'),
  MYSQL_PASSWORD: z.string().default(''),
  MYSQL_DATABASE: z.string().default('easystack'),
});

const parsed = MySQLEnv.parse(process.env);

export const mysql = {
  host: parsed.MYSQL_HOST,
  port: parsed.MYSQL_PORT,
  user: parsed.MYSQL_APP_USER || parsed.MYSQL_USER,
  password: parsed.MYSQL_APP_PASSWORD || parsed.MYSQL_PASSWORD,
  database: parsed.MYSQL_DATABASE,
};

export default mysql;
