/**
 * Shared ioredis singleton for backend services that use the ioredis API
 * (streams, pipelines, pub/sub). Services that only need simple get/set
 * should use the node-redis helpers in `./redis.ts` instead.
 *
 * Using a singleton avoids creating uncoordinated connections per-module.
 */

import Redis from "ioredis";

import { logger } from "./logger.js";

let instance: Redis | null = null;

export function getIoRedisClient(): Redis {
  if (!instance) {
    instance = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    instance.on("error", (err) => {
      logger.error("ioredis client error", err instanceof Error ? err : new Error(String(err)));
    });

    instance.on("connect", () => {
      logger.info("ioredis client connected");
    });
  }

  return instance;
}
