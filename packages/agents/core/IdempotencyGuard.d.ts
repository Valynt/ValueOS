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
export interface IdempotencyStore {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds: number): Promise<void>;
}
export interface IdempotencyResult<T = unknown> {
    cached: boolean;
    result: T;
}
/** Accepts UUIDs or any non-empty string up to 512 chars (for deterministic step keys). */
export declare const IdempotencyKeySchema: z.ZodString;
export declare class IdempotencyGuard {
    private store;
    private ttlSeconds;
    constructor(store: IdempotencyStore, ttlSeconds?: number);
    /**
     * Generate a new random idempotency key (UUIDv4).
     * Prefer deterministic keys derived from step identity when possible.
     */
    static generateKey(): string;
    /**
     * Validate that a key is acceptable (non-empty, bounded length).
     */
    static validateKey(key: string): boolean;
    /**
     * Execute a function with idempotency protection.
     * If the key has been seen before, returns the cached result.
     * Otherwise, executes the function and caches the result.
     */
    execute<T>(idempotencyKey: string, fn: () => Promise<T>): Promise<IdempotencyResult<T>>;
    /**
     * Check if a key has already been processed (without executing)
     */
    hasBeenProcessed(idempotencyKey: string): Promise<boolean>;
    /**
     * Get the cached result for a key (if any)
     */
    getCachedResult<T>(idempotencyKey: string): Promise<T | null>;
}
//# sourceMappingURL=IdempotencyGuard.d.ts.map