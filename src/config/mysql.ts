import 'dotenv/config';
import { z } from 'zod';

const MySQLEnv = z.object({
  MYSQL_HOST: z.string().default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_USER: z.string().default('root'),
  MYSQL_PASSWORD: z.string().default(''),
  MYSQL_DATABASE: z.string().default('easystack'),
});

const parsed = MySQLEnv.parse(process.env);

export const mysql = {
  host: parsed.MYSQL_HOST,
  port: parsed.MYSQL_PORT,
  user: parsed.MYSQL_USER,
  password: parsed.MYSQL_PASSWORD,
  database: parsed.MYSQL_DATABASE,
};

export default mysql;
