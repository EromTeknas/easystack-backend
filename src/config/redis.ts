import type { RedisOptions } from 'ioredis';
import { env } from "./env";

const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  ...(env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : {}),
  db: env.REDIS_DB,
  maxRetriesPerRequest: null,
};

export const redisConnectionOptions: RedisOptions = redisOptions;
export default redisConnectionOptions;

