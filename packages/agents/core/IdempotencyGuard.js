"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyGuard = exports.IdempotencyKeySchema = void 0;
const zod_1 = require("zod");
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
exports.IdempotencyKeySchema = zod_1.z.string().min(1).max(MAX_KEY_LENGTH);
// ============================================================================
// IdempotencyGuard
// ============================================================================
class IdempotencyGuard {
    store;
    ttlSeconds;
    constructor(store, ttlSeconds = DEFAULT_TTL_SECONDS) {
        this.store = store;
        this.ttlSeconds = ttlSeconds;
    }
    /**
     * Generate a new random idempotency key (UUIDv4).
     * Prefer deterministic keys derived from step identity when possible.
     */
    static generateKey() {
        return crypto.randomUUID();
    }
    /**
     * Validate that a key is acceptable (non-empty, bounded length).
     */
    static validateKey(key) {
        return exports.IdempotencyKeySchema.safeParse(key).success;
    }
    /**
     * Execute a function with idempotency protection.
     * If the key has been seen before, returns the cached result.
     * Otherwise, executes the function and caches the result.
     */
    async execute(idempotencyKey, fn) {
        if (!IdempotencyGuard.validateKey(idempotencyKey)) {
            throw new Error(`Invalid idempotency key: "${idempotencyKey}". Must be a non-empty string (max ${MAX_KEY_LENGTH} chars).`);
        }
        const cacheKey = `${IDEMPOTENCY_PREFIX}${idempotencyKey}`;
        // Check for cached result
        const cached = await this.store.get(cacheKey);
        if (cached !== null) {
            return {
                cached: true,
                result: JSON.parse(cached),
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
    async hasBeenProcessed(idempotencyKey) {
        const cacheKey = `${IDEMPOTENCY_PREFIX}${idempotencyKey}`;
        const cached = await this.store.get(cacheKey);
        return cached !== null;
    }
    /**
     * Get the cached result for a key (if any)
     */
    async getCachedResult(idempotencyKey) {
        const cacheKey = `${IDEMPOTENCY_PREFIX}${idempotencyKey}`;
        const cached = await this.store.get(cacheKey);
        if (cached === null)
            return null;
        return JSON.parse(cached);
    }
}
exports.IdempotencyGuard = IdempotencyGuard;
//# sourceMappingURL=IdempotencyGuard.js.map