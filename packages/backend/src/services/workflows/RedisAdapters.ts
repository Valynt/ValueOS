import {
  DLQEventEmitter,
  DLQStore,
  IdempotencyStore
} from "../../lib/agents/core/index.js";

import { getIoRedisClient } from "../../lib/ioredisClient.js";
import { logger } from "../../lib/logger.js";

const redis = getIoRedisClient();

/**
 * Redis implementation of IdempotencyStore (R5).
 */
export class RedisIdempotencyStore implements IdempotencyStore {
  async get(key: string): Promise<string | null> {
    return await redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await redis.set(key, value, 'EX', ttlSeconds);
  }
}

/**
 * Redis implementation of DLQStore (R6).
 */
export class RedisDLQStore implements DLQStore {
  async lpush(key: string, value: string): Promise<void> {
    await redis.lpush(key, value);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return await redis.lrange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    return await redis.llen(key);
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    return await redis.lrem(key, count, value);
  }
}

/**
 * Implementation of DLQEventEmitter.
 */
export class DomainDLQEventEmitter implements DLQEventEmitter {
  emit(event: {
    type: string;
    payload: Record<string, unknown>;
    meta: { correlationId: string; timestamp: string; source: string };
  }): void {
    logger.warn(`DLQ Event: ${event.type}`, event);
    // In a real system, trigger alerts (PagerDuty, Slack, etc.)
  }
}
