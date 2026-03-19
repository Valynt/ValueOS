import { logger } from '../lib/logger';

export interface SecureCacheOptions {
  ttlMs?: number;
  tenantId?: string;
}

interface ObfuscatedCacheEntry {
  cipher: Uint8Array;
  pad: Uint8Array;
}

interface SecureCacheRecord {
  entry: ObfuscatedCacheEntry;
  createdAt: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBytes(value: unknown): Uint8Array {
  return textEncoder.encode(JSON.stringify(value));
}

function fromBytes<T>(value: Uint8Array): T {
  return JSON.parse(textDecoder.decode(value)) as T;
}

function createPad(size: number): Uint8Array {
  const pad = new Uint8Array(size);
  globalThis.crypto.getRandomValues(pad);
  return pad;
}

function xorBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.length);
  for (let index = 0; index < left.length; index += 1) {
    result[index] = left[index]! ^ right[index]!;
  }
  return result;
}

/**
 * Browser-safe in-memory cache with best-effort value obscuring + zeroization.
 * This avoids importing server-only secret helpers into the frontend bundle.
 */
export class SecureCache<T = unknown> {
  private store: Map<string, SecureCacheRecord> = new Map();
  private readonly ttlMs: number;
  private readonly tenantId: string;

  constructor(options: SecureCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000;
    this.tenantId = options.tenantId || 'system';
  }

  set(key: string, value: T): void {
    const existing = this.store.get(key);
    if (existing) {
      this.zeroize(existing.entry);
    }

    const plainBytes = toBytes(value);
    const pad = createPad(plainBytes.length);
    const cipher = xorBytes(plainBytes, pad);
    plainBytes.fill(0);

    this.store.set(key, {
      entry: { cipher, pad },
      createdAt: Date.now(),
    });
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
      const plainBytes = xorBytes(record.entry.cipher, record.entry.pad);
      const value = fromBytes<T>(plainBytes);
      plainBytes.fill(0);
      return value;
    } catch (error) {
      logger.error('SecureCache decode failed, dropping entry', error instanceof Error ? error : new Error(String(error)), {
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
        removed += 1;
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

  private zeroize(entry: ObfuscatedCacheEntry): void {
    entry.cipher.fill(0);
    entry.pad.fill(0);
  }
}

export const secureCache = new SecureCache();
