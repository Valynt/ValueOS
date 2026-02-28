import { createClient, RedisClientType } from "redis";

import { logger } from "../utils/logger";

export interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitBucket | null>;
  set(key: string, bucket: RateLimitBucket, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  shutdown(): Promise<void>;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { bucket: RateLimitBucket; expiresAt: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  async get(key: string): Promise<RateLimitBucket | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.bucket;
  }

  async set(key: string, bucket: RateLimitBucket, ttlMs: number): Promise<void> {
    this.store.set(key, { bucket, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async shutdown(): Promise<void> {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  private client: RedisClientType | null = null;
  private connecting: Promise<RedisClientType> | null = null;
  private readonly prefix = "ratelimit:";

  private async getClient(): Promise<RedisClientType> {
    if (this.client?.isOpen) {
      return this.client;
    }

    if (!this.connecting) {
      this.client = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
      });

      this.client.on("error", (error) => {
        logger.error("Redis rate limit store error", error as Error);
        this.connecting = null;
      });

      this.connecting = this.client.connect().then(() => this.client as RedisClientType);
    }

    return this.connecting;
  }

  async get(key: string): Promise<RateLimitBucket | null> {
    const client = await this.getClient();
    const payload = await client.get(this.prefix + key);
    if (!payload) return null;

    try {
      const parsed = JSON.parse(payload) as RateLimitBucket;
      if (typeof parsed.tokens !== "number" || typeof parsed.lastRefill !== "number") {
        return null;
      }
      return parsed;
    } catch (error) {
      logger.warn("Failed to parse rate limit bucket from Redis", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async set(key: string, bucket: RateLimitBucket, ttlMs: number): Promise<void> {
    const client = await this.getClient();
    await client.set(this.prefix + key, JSON.stringify(bucket), {
      PX: ttlMs,
    });
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(this.prefix + key);
  }

  async shutdown(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
    this.client = null;
    this.connecting = null;
  }
}

export function createRateLimitStore(): RateLimitStore {
  if (process.env.RATE_LIMIT_STORE === "redis") {
    return new RedisRateLimitStore();
  }

  if (process.env.NODE_ENV === "production") {
    return new RedisRateLimitStore();
  }

  return new InMemoryRateLimitStore();
}
