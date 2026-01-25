import mysql from 'mysql2/promise';
import logger from '../utils/logger';
import { mysql as mysqlConfig } from '../config/index';

let pool: mysql.Pool | null = null;

export async function connectMySQL() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
  });

  try {
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    logger.info('MySQL connected and tested');
    return pool;
  } catch (err) {
    logger.error(`MySQL connection error: ${String(err)}`);
    throw err;
  }
}

export function getPool() {
  if (!pool) throw new Error('MySQL pool not initialized. Call connectMySQL first.');
  return pool;
}
