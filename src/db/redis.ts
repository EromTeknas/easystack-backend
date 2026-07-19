import { Redis } from "ioredis";
import { redisConnectionOptions } from "../config/redis";

export const redisClient = new Redis(redisConnectionOptions);
export default redisClient;
