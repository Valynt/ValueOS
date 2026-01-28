/**
 * Simple in-memory cache with TTL
 */
export class Cache {
  private cache = new Map<string, { data: any; expiry: number }>();

  constructor(private defaultTTL: number = 300000) {} // 5 minutes default

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiry });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    // Clean expired entries
    for (const [key, entry] of Array.from(this.cache)) {
      if (Date.now() > entry.expiry) {
        this.cache.delete(key);
      }
    }
    return this.cache.size;
  }
}
