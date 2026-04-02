import { ZodType } from 'zod';

import { cacheEncryption, EncryptedCacheEntry } from '../config/secrets/CacheEncryption';
import { logger } from '../lib/logger';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface SecureCacheOptions<T extends JsonValue = JsonValue> {
  ttlMs?: number;
  tenantId?: string;
  parser?: (value: unknown) => T;
  schema?: ZodType<T>;
}

interface SecureCacheRecord {
  entry: EncryptedCacheEntry;
  createdAt: number;
}

/**
 * SecureCache keeps sensitive values encrypted in memory and wipes
 * buffers when entries expire or are removed.
 */
export class SecureCache<T extends JsonValue = JsonValue> {
  private store: Map<string, SecureCacheRecord> = new Map();
  private readonly ttlMs: number;
  private readonly tenantId: string;
  private readonly parser: (value: unknown) => T;

  constructor(options: SecureCacheOptions<T> = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes
    this.tenantId = options.tenantId || 'system';
    this.parser = options.schema
      ? (value: unknown) => options.schema!.parse(value)
      : options.parser ?? this.defaultParser;
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
      const decrypted = cacheEncryption.decrypt(record.entry, this.tenantId);
      return this.parser(decrypted);
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

  private defaultParser(value: unknown): T {
    if (!isJsonValue(value)) {
      throw new Error('SecureCache payload is not valid JSON');
    }

    return value as T;
  }

  private zeroize(entry: EncryptedCacheEntry): void {
    entry.encrypted.fill(0);
    entry.iv.fill(0);
    entry.authTag.fill(0);
  }
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }

  return false;
}

export const secureCache = new SecureCache();
