import redis from "../../../db/redis";

export class UsageCache {
  private key(workspaceId: number, quotaKey: string) {
    return `billing:v1:workspace:${workspaceId}:usage:${quotaKey}`;
  }

  async get(workspaceId: number, quotaKey: string) {
    const value = await redis.get(this.key(workspaceId, quotaKey));

    return value ? Number(value) : null;
  }

  async set(workspaceId: number, quotaKey: string, value: number, ttl?: number) {
    if (ttl) {
      await redis.set(this.key(workspaceId, quotaKey), String(value), "EX", ttl);
      return;
    }

    await redis.set(this.key(workspaceId, quotaKey), String(value));
  }

  async increment(workspaceId: number, quotaKey: string, value = 1) {
    return redis.incrby(this.key(workspaceId, quotaKey), value);
  }

  async decrement(workspaceId: number, quotaKey: string, value = 1) {
    return redis.decrby(this.key(workspaceId, quotaKey), value);
  }

  async delete(workspaceId: number, quotaKey: string) {
    await redis.del(this.key(workspaceId, quotaKey));
  }
}
