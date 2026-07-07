import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisRateLimiter } from "./rate-limiter";
import { redis } from "@/lib/redis";

describe("RedisRateLimiter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should fall back to in-memory when Redis status is not ready", async () => {
    vi.spyOn(redis, "status", "get").mockReturnValue("connecting");

    const limiter = new RedisRateLimiter("test", 2, 1000);

    const isLimited1 = await limiter.isRateLimited("user1");
    const isLimited2 = await limiter.isRateLimited("user1");
    const isLimited3 = await limiter.isRateLimited("user1");

    expect(isLimited1).toBe(false);
    expect(isLimited2).toBe(false);
    expect(isLimited3).toBe(true);
  });

  it("should increment and block using Redis pipeline when Redis is ready", async () => {
    vi.spyOn(redis, "status", "get").mockReturnValue("ready");

    const mockExec = vi.fn().mockResolvedValue([
      [null, 3],
      [null, 50],
    ]);

    const mockMulti = {
      incr: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: mockExec,
    };

    vi.spyOn(redis, "multi").mockReturnValue(mockMulti as unknown as ReturnType<typeof redis.multi>);

    const limiter = new RedisRateLimiter("test", 2, 1000);
    const isLimited = await limiter.isRateLimited("user-redis");

    expect(isLimited).toBe(true);
    expect(redis.multi).toHaveBeenCalled();
  });
});
