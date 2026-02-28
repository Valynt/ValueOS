/**
 * Idempotency Guard
 *
 * Prevents duplicate agent execution by checking/storing results
 * keyed by a deterministic idempotency key in Redis.
 *
 * Keys should be derived from the semantic identity of the operation
 * (e.g., "case-123:model:0") so that retries of the same logical step
 * hit the cache — even across process restarts.
 *
 * - Before execution: check Redis for `idempotency:{key}` — if exists, return cached result
 * - After execution: store result with 24-hour TTL
 */

import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export interface IdempotencyStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export interface IdempotencyResult<T = unknown> {
  cached: boolean;
  result: T;
}

// ============================================================================
// Constants
// ============================================================================

const IDEMPOTENCY_PREFIX = 'idempotency:';
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MAX_KEY_LENGTH = 512;

// ============================================================================
// Zod Schema for idempotency key validation
// ============================================================================

/** Accepts UUIDs or any non-empty string up to 512 chars (for deterministic step keys). */
export const IdempotencyKeySchema = z.string().min(1).max(MAX_KEY_LENGTH);

// ============================================================================
// IdempotencyGuard
// ============================================================================

export class IdempotencyGuard {
  private store: IdempotencyStore;
  private ttlSeconds: number;

  constructor(store: IdempotencyStore, ttlSeconds: number = DEFAULT_TTL_SECONDS) {
    this.store = store;
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Generate a new random idempotency key (UUIDv4).
   * Prefer deterministic keys derived from step identity when possible.
   */
  static generateKey(): string {
    return crypto.randomUUID();
  }

  /**
   * Validate that a key is acceptable (non-empty, bounded length).
   */
  static validateKey(key: string): boolean {
    return IdempotencyKeySchema.safeParse(key).success;
  }

  /**
   * Execute a function with idempotency protection.
   * If the key has been seen before, returns the cached result.
   * Otherwise, executes the function and caches the result.
   */
  async execute<T>(
    idempotencyKey: string,
    fn: () => Promise<T>
  ): Promise<IdempotencyResult<T>> {
    if (!IdempotencyGuard.validateKey(idempotencyKey)) {
      throw new Error(
        `Invalid idempotency key: "${idempotencyKey}". Must be a non-empty string (max ${MAX_KEY_LENGTH} chars).`
      );
    }

    const cacheKey = `${IDEMPOTENCY_PREFIX}${idempotencyKey}`;

    // Check for cached result
    const cached = await this.store.get(cacheKey);
    if (cached !== null) {
      return {
        cached: true,
        result: JSON.parse(cached) as T,
      };
    }

    // Execute the function
    const result = await fn();

    // Cache the result
    await this.store.set(cacheKey, JSON.stringify(result), this.ttlSeconds);

    return {
      cached: false,
      result,
    };
  }

  /**
   * Check if a key has already been processed (without executing)
   */
  async hasBeenProcessed(idempotencyKey: string): Promise<boolean> {
    const cacheKey = `${IDEMPOTENCY_PREFIX}${idempotencyKey}`;
    const cached = await this.store.get(cacheKey);
    return cached !== null;
  }

  /**
   * Get the cached result for a key (if any)
   */
  async getCachedResult<T>(idempotencyKey: string): Promise<T | null> {
    const cacheKey = `${IDEMPOTENCY_PREFIX}${idempotencyKey}`;
    const cached = await this.store.get(cacheKey);
    if (cached === null) return null;
    return JSON.parse(cached) as T;
  }
}
