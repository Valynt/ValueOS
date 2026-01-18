/**
 * Rate Limiter
 * Token bucket algorithm for API rate limiting
 */

import { createClient } from "@supabase/supabase-js";

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export interface RateLimiterConfig {
  adapterId: string;
  maxRequests: number;
  windowMs: number;
  burstAllowance?: number;
}

export class RateLimiter {
  private supabase: ReturnType<typeof createClient>;

  constructor(
    private config: RateLimiterConfig,
    supabase?: ReturnType<typeof createClient>
  ) {
    this.supabase =
      supabase ||
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
  }

  /**
   * Acquire tokens from the rate limit bucket
   */
  async acquire(tokens: number = 1): Promise<void> {
    const key = `rate_limit:${this.config.adapterId}`;
    const now = Date.now();

    // Get current bucket state
    const bucketState = await this.getBucketState(key);

    // Refill tokens based on elapsed time
    const elapsedMs = now - bucketState.lastRefill;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const tokensToAdd = Math.floor(elapsedMs * refillRate);

    const maxTokens = this.config.burstAllowance || this.config.maxRequests;
    const currentTokens = Math.min(bucketState.tokens + tokensToAdd, maxTokens);

    // Check if we have enough tokens
    if (currentTokens >= tokens) {
      // Consume tokens
      await this.updateBucketState(key, {
        tokens: currentTokens - tokens,
        lastRefill: now,
      });
    } else {
      // Calculate wait time
      const tokensNeeded = tokens - currentTokens;
      const waitTimeMs = Math.ceil(tokensNeeded / refillRate);

      throw new RateLimitError(
        `Rate limit exceeded for ${this.config.adapterId}. Retry after ${waitTimeMs}ms`,
        waitTimeMs
      );
    }
  }

  /**
   * Check remaining capacity without consuming tokens
   */
  async check(): Promise<{ available: number; max: number }> {
    const key = `rate_limit:${this.config.adapterId}`;
    const now = Date.now();
    const bucketState = await this.getBucketState(key);

    const elapsedMs = now - bucketState.lastRefill;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const tokensToAdd = Math.floor(elapsedMs * refillRate);

    const maxTokens = this.config.burstAllowance || this.config.maxRequests;
    const available = Math.min(bucketState.tokens + tokensToAdd, maxTokens);

    return { available, max: maxTokens };
  }

  /**
   * Reset the rate limit bucket (for testing)
   */
  async reset(): Promise<void> {
    const key = `rate_limit:${this.config.adapterId}`;
    const maxTokens = this.config.burstAllowance || this.config.maxRequests;

    await this.updateBucketState(key, {
      tokens: maxTokens,
      lastRefill: Date.now(),
    });
  }

  /**
   * Get bucket state from storage
   */
  private async getBucketState(
    key: string
  ): Promise<{ tokens: number; lastRefill: number }> {
    const { data, error } = await this.supabase
      .from("rate_limit_buckets")
      .select("tokens, last_refill")
      .eq("key", key)
      .single();

    if (error || !data) {
      // Initialize bucket
      const maxTokens = this.config.burstAllowance || this.config.maxRequests;
      const newState = {
        key,
        tokens: maxTokens,
        last_refill: Date.now(),
      };

      await this.supabase.from("rate_limit_buckets").upsert(newState);

      return { tokens: maxTokens, lastRefill: Date.now() };
    }

    return {
      tokens: data.tokens,
      lastRefill: new Date(data.last_refill).getTime(),
    };
  }

  /**
   * Update bucket state in storage
   */
  private async updateBucketState(
    key: string,
    state: { tokens: number; lastRefill: number }
  ): Promise<void> {
    await this.supabase.from("rate_limit_buckets").upsert({
      key,
      tokens: state.tokens,
      last_refill: new Date(state.lastRefill).toISOString(),
    });
  }
}

/**
 * In-memory rate limiter for development/testing
 */
export class InMemoryRateLimiter extends RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  protected async getBucketState(key: string) {
    if (!this.buckets.has(key)) {
      const maxTokens = this.config.burstAllowance || this.config.maxRequests;
      this.buckets.set(key, {
        tokens: maxTokens,
        lastRefill: Date.now(),
      });
    }
    return this.buckets.get(key)!;
  }

  protected async updateBucketState(
    key: string,
    state: { tokens: number; lastRefill: number }
  ) {
    this.buckets.set(key, state);
  }
}

export default RateLimiter;
