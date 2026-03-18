import { createHash } from 'crypto';

import type { Redis as RedisClientType } from 'ioredis';

/**
 * Nonce store with in-memory storage.
 * Prevents replay attacks when combined with timestamp checks.
 *
 * Redis-backed to ensure distributed replay protection across instances.
 */
export class NonceStoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonceStoreUnavailableError';
  }
}

type RedisNonceClient = Pick<RedisClientType, 'set'>;

interface NonceStoreOptions {
  ttlMs?: number;
  redisClient?: RedisNonceClient;
  redisConfigured?: boolean;
}

export class NonceStore {
  private memory = new Map<string, number>();
  private ttlMs: number;
  private redisClient: RedisNonceClient | null = null;
  private redisConfigured: boolean;
  private redisInit: Promise<void> | null = null;
  private redisError: Error | null = null;

  constructor(options: NonceStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000;
    this.redisClient = options.redisClient ?? null;
    this.redisConfigured = options.redisConfigured ?? Boolean(process.env.REDIS_URL);
  }

  private async ensureRedisClient(): Promise<RedisNonceClient | null> {
    if (this.redisClient) {
      return this.redisClient;
    }

    if (!this.redisConfigured) {
      return null;
    }

    if (!this.redisInit) {
      this.redisInit = import(/* @vite-ignore */ '@shared/lib/redisClient')
        .then(({ getRedisClient }) => getRedisClient())
        .then((client) => {
          this.redisClient = client;
        })
        .catch((error) => {
          this.redisError = error as Error;
        });
    }

    await this.redisInit;
    return this.redisClient;
  }

  private buildKey(issuer: string, nonce: string): string {
    const issuerHash = createHash('sha256').update(issuer).digest('hex');
    return `svc_nonce:${issuerHash}:${nonce}`;
  }

  private consumeInMemory(key: string): boolean {
    const now = Date.now();
    const existing = this.memory.get(key);
    if (existing && now - existing < this.ttlMs) {
      return false;
    }
    this.memory.set(key, now);
    return true;
  }

  /**
   * Returns true if nonce is unique (not seen), false if replayed.
   */
  async consumeOnce(
    issuer: string,
    nonce: string,
    options: { requireRedis?: boolean } = {}
  ): Promise<boolean> {
    const key = this.buildKey(issuer, nonce);
    const redisClient = await this.ensureRedisClient();

    if (redisClient) {
      const ttlSeconds = Math.ceil(this.ttlMs / 1000);
      try {
        const result = await redisClient.set(key, Date.now().toString(), {
          NX: true,
          EX: ttlSeconds,
        });
        return result === 'OK';
      } catch (error) {
        this.redisError = error as Error;
        if (options.requireRedis) {
          throw new NonceStoreUnavailableError('Redis unavailable for nonce replay protection');
        }
      }
    } else if (options.requireRedis) {
      const reason = this.redisConfigured
        ? 'Redis unavailable for nonce replay protection'
        : 'Redis not configured for nonce replay protection';
      throw new NonceStoreUnavailableError(reason);
    }

    return this.consumeInMemory(key);
  }
}

export const nonceStore = new NonceStore();
