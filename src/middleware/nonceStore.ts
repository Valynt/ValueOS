// NOTE: Redis client import removed to avoid bundling server-side Express middleware in client
// If Redis is needed, it should be conditionally imported server-side only
// import { redisClient } from './llmRateLimiter';

/**
 * Nonce store with in-memory storage.
 * Prevents replay attacks when combined with timestamp checks.
 * 
 * Note: Redis backing removed to prevent client/server code mixing.
 * For production, implement Redis in server-side middleware only.
 */
class NonceStore {
  private memory = new Map<string, number>();
  private ttlMs: number;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  /**
   * Returns true if nonce is unique (not seen), false if replayed.
   */
  async consumeOnce(key: string): Promise<boolean> {
    // Use in-memory cache only (Redis integration should be server-side only)
    const now = Date.now();
    const existing = this.memory.get(key);
    if (existing && now - existing < this.ttlMs) {
      return false;
    }
    this.memory.set(key, now);
    return true;
  }
}

export const nonceStore = new NonceStore();

