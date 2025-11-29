import { redisClient } from './llmRateLimiter';

/**
 * Nonce store with Redis backing and in-memory fallback.
 * Prevents replay attacks when combined with timestamp checks.
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
    // Prefer Redis if connected
    try {
      if (redisClient?.isOpen) {
        const result = await redisClient.set(key, '1', {
          NX: true,
          PX: this.ttlMs,
        });
        return result === 'OK';
      }
    } catch (error) {
      // fall through to memory cache
      console.error('NonceStore redis error', error);
    }

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

