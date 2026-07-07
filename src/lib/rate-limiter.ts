import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

class InMemoryRateLimiter {
  private cache = new Map<string, { count: number; resetTime: number }>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  public isRateLimited(key: string): boolean {
    const now = Date.now();
    const client = this.cache.get(key);

    if (!client || now > client.resetTime) {
      this.cache.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return false;
    }

    if (client.count >= this.maxRequests) {
      return true;
    }

    client.count++;
    return false;
  }
}

export class RedisRateLimiter {
  private fallbackLimiter: InMemoryRateLimiter;

  constructor(
    private name: string,
    private maxRequests: number,
    private windowMs: number
  ) {
    this.fallbackLimiter = new InMemoryRateLimiter(maxRequests, windowMs);
  }

  public async isRateLimited(key: string): Promise<boolean> {
    const isRedisReady = redis.status === "ready";

    if (!isRedisReady) {
      return this.fallbackLimiter.isRateLimited(key);
    }

    const redisKey = `ratelimit:${this.name}:${key}`;
    const windowSeconds = Math.max(1, Math.ceil(this.windowMs / 1000));

    try {
      const result = await redis
        .multi()
        .incr(redisKey)
        .ttl(redisKey)
        .exec();

      if (!result) {
        return this.fallbackLimiter.isRateLimited(key);
      }

      const count = result[0][1] as number;
      const ttl = result[1][1] as number;

      if (ttl === -1) {
        await redis.expire(redisKey, windowSeconds);
      }

      return count > this.maxRequests;
    } catch (err) {
      logger.warn("logs.redisRateLimitFailed", { error: err instanceof Error ? err.message : String(err) });
      return this.fallbackLimiter.isRateLimited(key);
    }
  }
}

// Ldap Sync: Tối đa 3 lần / phút
export const ldapSyncLimiter = new RedisRateLimiter("ldapsync", 3, 60 * 1000);

// Reset mật khẩu: Tối đa 5 lần / phút
export const passwordResetLimiter = new RedisRateLimiter("resetpwd", 5, 60 * 1000);
