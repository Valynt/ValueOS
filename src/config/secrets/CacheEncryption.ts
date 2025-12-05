/**
 * Cache Encryption
 * 
 * Encrypts cached secrets at rest using AES-256-GCM
 * Protects against memory dumps and process inspection
 * 
 * Sprint 4: Advanced Features
 * Created: 2024-11-29
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { logger } from '../../lib/logger';

/**
 * Encrypted cache entry
 */
export interface EncryptedCacheEntry {
  encrypted: Buffer;
  iv: Buffer;
  authTag: Buffer;
  expiresAt: number;
}

/**
 * Cache encryption configuration
 */
export interface EncryptionConfig {
  algorithm: string;
  keyDerivation: 'pbkdf2' | 'scrypt';
  cacheTTL: number;
}

/**
 * Cache encryption manager
 * 
 * Encrypts secrets in memory using AES-256-GCM
 * Keys derived from KMS or environment
 */
export class CacheEncryption {
  private algorithm: string = 'aes-256-gcm';
  private encryptionKey: Buffer;
  private cacheTTL: number;
  private encryptionEnabled: boolean;

  constructor(config?: Partial<EncryptionConfig>) {
    this.algorithm = config?.algorithm || 'aes-256-gcm';
    this.cacheTTL = config?.cacheTTL || 300000; // 5 minutes
    
    // Initialize encryption key
    this.encryptionKey = this.deriveEncryptionKey();
    
    // Check if encryption is enabled
    this.encryptionEnabled = process.env.CACHE_ENCRYPTION_ENABLED !== 'false';

    if (this.encryptionEnabled) {
      logger.info('Cache encryption initialized', {
        algorithm: this.algorithm,
        cacheTTL: this.cacheTTL
      });
    } else {
      logger.warn('Cache encryption is DISABLED - not recommended for production');
    }
  }

  /**
   * Derive encryption key from environment or KMS
   */
  private deriveEncryptionKey(): Buffer {
    // In production, this should fetch from KMS (AWS KMS, GCP KMS, etc.)
    // For now, derive from environment variable or generate
    
    const masterKey = process.env.CACHE_ENCRYPTION_KEY;
    
    if (masterKey) {
      // Derive key using SHA-256
      return createHash('sha256')
        .update(masterKey)
        .digest();
    }

    // Generate random key (WARNING: not persistent across restarts)
    logger.warn('No CACHE_ENCRYPTION_KEY set - generating random key (not persistent)');
    return randomBytes(32);
  }

  /**
   * Encrypt cache entry
   */
  encrypt(data: any, tenantId: string): EncryptedCacheEntry {
    if (!this.encryptionEnabled) {
      // Return unencrypted (for development only)
      return {
        encrypted: Buffer.from(JSON.stringify(data)),
        iv: Buffer.alloc(0),
        authTag: Buffer.alloc(0),
        expiresAt: Date.now() + this.cacheTTL
      };
    }

    const startTime = Date.now();

    try {
      // Generate random IV
      const iv = randomBytes(16);

      // Create cipher
      const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);

      // Add tenant ID as additional authenticated data (AAD)
      cipher.setAAD(Buffer.from(tenantId));

      // Encrypt
      const plaintext = JSON.stringify(data);
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get auth tag
      const authTag = cipher.getAuthTag();

      const duration = Date.now() - startTime;

      logger.debug('Cache entry encrypted', {
        tenantId,
        size: encrypted.length,
        duration
      });

      return {
        encrypted,
        iv,
        authTag,
        expiresAt: Date.now() + this.cacheTTL
      };
    } catch (error) {
      logger.error('Encryption failed', error instanceof Error ? error : new Error(String(error)), {
        tenantId
      });
      throw error;
    }
  }

  /**
   * Decrypt cache entry
   */
  decrypt(entry: EncryptedCacheEntry, tenantId: string): any {
    if (!this.encryptionEnabled) {
      // Return unencrypted (for development only)
      return JSON.parse(entry.encrypted.toString());
    }

    const startTime = Date.now();

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      throw new Error('Cache entry expired');
    }

    try {
      // Create decipher
      const decipher = createDecipheriv(this.algorithm, this.encryptionKey, entry.iv);

      // Set AAD
      decipher.setAAD(Buffer.from(tenantId));

      // Set auth tag
      decipher.setAuthTag(entry.authTag);

      // Decrypt
      let decrypted = decipher.update(entry.encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      const duration = Date.now() - startTime;

      logger.debug('Cache entry decrypted', {
        tenantId,
        duration
      });

      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      logger.error('Decryption failed', error instanceof Error ? error : new Error(String(error)), {
        tenantId
      });
      throw error;
    }
  }

  /**
   * Check if entry is expired
   */
  isExpired(entry: EncryptedCacheEntry): boolean {
    return entry.expiresAt < Date.now();
  }

  /**
   * Rotate encryption key (for key rotation)
   */
  rotateKey(newMasterKey: string): void {
    logger.info('Rotating cache encryption key');

    this.encryptionKey = createHash('sha256')
      .update(newMasterKey)
      .digest();

    logger.info('Cache encryption key rotated successfully');
  }

  /**
   * Get encryption statistics
   */
  getStatistics(): {
    enabled: boolean;
    algorithm: string;
    keySize: number;
  } {
    return {
      enabled: this.encryptionEnabled,
      algorithm: this.algorithm,
      keySize: this.encryptionKey.length * 8 // bits
    };
  }

  /**
   * Benchmark encryption performance
   */
  async benchmark(iterations: number = 1000): Promise<{
    averageEncryptionMs: number;
    averageDecryptionMs: number;
    throughputMBps: number;
  }> {
    const testData = { test: 'A'.repeat(1000) }; // 1KB test data
    const tenantId = 'benchmark-tenant';

    let totalEncryptMs = 0;
    let totalDecryptMs = 0;

    for (let i = 0; i < iterations; i++) {
      // Encrypt
      const encStart = Date.now();
      const encrypted = this.encrypt(testData, tenantId);
      totalEncryptMs += Date.now() - encStart;

      // Decrypt
      const decStart = Date.now();
      this.decrypt(encrypted, tenantId);
      totalDecryptMs += Date.now() - decStart;
    }

    const averageEncryptionMs = totalEncryptMs / iterations;
    const averageDecryptionMs = totalDecryptMs / iterations;
    
    // Calculate throughput (MB/s)
    const totalMs = totalEncryptMs + totalDecryptMs;
    const totalMB = (1 / 1024) * iterations * 2; // 1KB * iterations * 2 operations
    const throughputMBps = (totalMB / totalMs) * 1000;

    logger.info('Cache encryption benchmark complete', {
      iterations,
      averageEncryptionMs,
      averageDecryptionMs,
      throughputMBps
    });

    return {
      averageEncryptionMs,
      averageDecryptionMs,
      throughputMBps
    };
  }
}

/**
 * Encrypted cache store
 * 
 * Wrapper around Map with automatic encryption/decryption
 */
export class EncryptedCacheStore<T = any> {
  private store: Map<string, EncryptedCacheEntry> = new Map();
  private encryption: CacheEncryption;

  constructor(encryption: CacheEncryption) {
    this.encryption = encryption;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, tenantId: string): void {
    const encrypted = this.encryption.encrypt(value, tenantId);
    this.store.set(key, encrypted);
  }

  /**
   * Get value from cache
   */
  get(key: string, tenantId: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (this.encryption.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }

    try {
      return this.encryption.decrypt(entry, tenantId) as T;
    } catch (error) {
      logger.error('Failed to decrypt cache entry', error instanceof Error ? error : new Error(String(error)), {
        key,
        tenantId
      });
      this.store.delete(key);
      return null;
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    
    if (!entry) {
      return false;
    }

    if (this.encryption.isExpired(entry)) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete key
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Prune expired entries
   */
  pruneExpired(): number {
    let pruned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (this.encryption.isExpired(entry)) {
        this.store.delete(key);
        pruned++;
      }
    }

    if (pruned > 0) {
      logger.info('Pruned expired cache entries', { pruned });
    }

    return pruned;
  }
}

/**
 * Create cache encryption from environment
 */
export function createCacheEncryption(): CacheEncryption {
  return new CacheEncryption({
    algorithm: process.env.CACHE_ENCRYPTION_ALGORITHM || 'aes-256-gcm',
    cacheTTL: parseInt(process.env.CACHE_TTL || '300000', 10)
  });
}

/**
 * Global cache encryption instance
 */
export const cacheEncryption = createCacheEncryption();
