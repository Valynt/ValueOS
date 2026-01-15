/**
 * Cross-integration rate limiter
 *
 * Token bucket implementation with per-provider and per-tenant limits.
 */

import { RateLimitError } from "./errors.js";

interface RateLimiterConfig {
  provider: string;
  requestsPerMinute: number;
  burstLimit?: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number;
}

export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private readonly config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  private getBucketKey(tenantId: string): string {
    return `${this.config.provider}:${tenantId}`;
  }

  private getOrCreateBucket(tenantId: string): TokenBucket {
    const key = this.getBucketKey(tenantId);
    let bucket = this.buckets.get(key);

    if (!bucket) {
      const maxTokens = this.config.burstLimit ?? this.config.requestsPerMinute;
      bucket = {
        tokens: maxTokens,
        lastRefill: Date.now(),
        maxTokens,
        refillRate: this.config.requestsPerMinute / 60000,
      };
      this.buckets.set(key, bucket);
    }

    return bucket;
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * bucket.refillRate;

    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  async acquire(tenantId: string, tokens: number = 1): Promise<void> {
    const bucket = this.getOrCreateBucket(tenantId);
    this.refillBucket(bucket);

    if (bucket.tokens < tokens) {
      const waitTime = Math.ceil((tokens - bucket.tokens) / bucket.refillRate);
      throw new RateLimitError(this.config.provider, waitTime);
    }

    bucket.tokens -= tokens;
  }

  async tryAcquire(tenantId: string, tokens: number = 1): Promise<boolean> {
    try {
      await this.acquire(tenantId, tokens);
      return true;
    } catch {
      return false;
    }
  }

  getAvailableTokens(tenantId: string): number {
    const bucket = this.getOrCreateBucket(tenantId);
    this.refillBucket(bucket);
    return Math.floor(bucket.tokens);
  }

  reset(tenantId: string): void {
    const key = this.getBucketKey(tenantId);
    this.buckets.delete(key);
  }
}
