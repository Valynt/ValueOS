import { cacheEncryption, EncryptedCacheEntry } from '../config/secrets/CacheEncryption';
import { logger } from '../lib/logger';

export interface SecureCacheOptions {
  ttlMs?: number;
  tenantId?: string;
}

interface SecureCacheRecord {
  entry: EncryptedCacheEntry;
  createdAt: number;
}

/**
 * SecureCache keeps sensitive values encrypted in memory and wipes
 * buffers when entries expire or are removed.
 */
export class SecureCache<T = any> {
  private store: Map<string, SecureCacheRecord> = new Map();
  private readonly ttlMs: number;
  private readonly tenantId: string;

  constructor(options: SecureCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes
    this.tenantId = options.tenantId || 'system';
  }

  set(key: string, value: T): void {
    const existing = this.store.get(key);
    if (existing) {
      this.zeroize(existing.entry);
    }
    const encrypted = cacheEncryption.encrypt(value, this.tenantId);
    this.store.set(key, { entry: encrypted, createdAt: Date.now() });
  }

  get(key: string): T | null {
    const record = this.store.get(key);

    if (!record) {
      return null;
    }

    if (this.isExpired(record)) {
      this.zeroize(record.entry);
      this.store.delete(key);
      return null;
    }

    try {
      return cacheEncryption.decrypt(record.entry, this.tenantId) as T;
    } catch (error) {
      logger.error('SecureCache decrypt failed, dropping entry', error instanceof Error ? error : new Error(String(error)), {
        key,
        tenantId: this.tenantId,
      });
      this.zeroize(record.entry);
      this.store.delete(key);
      return null;
    }
  }

  delete(key: string): void {
    const record = this.store.get(key);
    if (record) {
      this.zeroize(record.entry);
      this.store.delete(key);
    }
  }

  clear(): void {
    for (const record of this.store.values()) {
      this.zeroize(record.entry);
    }
    this.store.clear();
  }

  pruneExpired(): number {
    let removed = 0;

    for (const [key, record] of this.store.entries()) {
      if (this.isExpired(record)) {
        this.zeroize(record.entry);
        this.store.delete(key);
        removed++;
      }
    }

    return removed;
  }

  size(): number {
    return this.store.size;
  }

  private isExpired(record: SecureCacheRecord): boolean {
    return Date.now() - record.createdAt > this.ttlMs;
  }

  private zeroize(entry: EncryptedCacheEntry): void {
    entry.encrypted.fill(0);
    entry.iv.fill(0);
    entry.authTag.fill(0);
  }
}

export const secureCache = new SecureCache();
