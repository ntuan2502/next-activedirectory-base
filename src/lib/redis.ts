import Redis from "ioredis";
import { logger } from "@/lib/logger";

const globalForRedis = global as unknown as { redis: Redis | undefined };

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis =
  globalForRedis.redis ||
  new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        logger.warn("logs.redisConnectionFailed");
        return null;
      }
      return Math.min(times * 100, 1000);
    },
  });

redis.on("connect", () => {
  logger.info("logs.redisConnected");
});

redis.on("error", (err) => {
  if (process.env.NODE_ENV !== "test") {
    logger.warn("logs.redisConnectionError", { error: err.message });
  }
});

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
export default redis;
