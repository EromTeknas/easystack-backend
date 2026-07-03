import redis from "../../../config/redis";

export class UsageCache {
  private key(userId: number, quotaKey: string) {
    return `billing:v1:usage:${userId}:${quotaKey}`;
  }

  async get(userId: number, quotaKey: string) {
    const value = await redis.get(this.key(userId, quotaKey));

    return value ? Number(value) : null;
  }

  async set(userId: number, quotaKey: string, value: number, ttl?: number) {
    if (ttl) {
      await redis.set(this.key(userId, quotaKey), String(value), "EX", ttl);
      return;
    }

    await redis.set(this.key(userId, quotaKey), String(value));
  }

  async increment(userId: number, quotaKey: string, value = 1) {
    return redis.incrby(this.key(userId, quotaKey), value);
  }

  async decrement(userId: number, quotaKey: string, value = 1) {
    return redis.decrby(this.key(userId, quotaKey), value);
  }

  async delete(userId: number, quotaKey: string) {
    await redis.del(this.key(userId, quotaKey));
  }
}
