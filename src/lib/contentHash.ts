/**
 * Content Hash Utility
 * 
 * Provides content-addressable storage (CAS) hashing for SDUI schemas.
 * Uses SHA-256 for content hashing, enabling:
 * - Immutable schema storage (hash = content identity)
 * - Cache invalidation based on content changes
 * - Version tracking without explicit versioning
 * 
 * @see Sprint 3: Cache Consistency (CAS System)
 */

import { logger } from './logger';

/**
 * Calculate SHA-256 hash of content
 * Works in both browser and Node.js environments
 */
export async function sha256(content: string): Promise<string> {
  try {
    // Browser environment
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Node.js environment (for SSR/testing)
    if (typeof globalThis !== 'undefined' && 'crypto' in globalThis) {
      const crypto = (globalThis as any).crypto;
      if (crypto?.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    }
    
    // Fallback: simple hash for environments without crypto
    return simpleHash(content);
  } catch (error) {
    logger.warn('SHA-256 not available, using fallback hash', {
      error: error instanceof Error ? error.message : String(error),
    });
    return simpleHash(content);
  }
}

/**
 * Simple hash fallback for environments without crypto.subtle
 * NOT cryptographically secure - only for cache keys
 */
function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex and pad to 64 chars to match SHA-256 length
  const hex = Math.abs(hash).toString(16);
  return hex.padStart(16, '0').repeat(4);
}

/**
 * Content hash result
 */
export interface ContentHashResult {
  /** The SHA-256 hash of the content */
  hash: string;
  
  /** Original content size in bytes */
  size: number;
  
  /** Timestamp when hash was generated */
  timestamp: number;
}

/**
 * Hash an object by serializing to JSON
 * Ensures consistent serialization for reproducible hashes
 */
export async function hashObject(obj: unknown): Promise<ContentHashResult> {
  // Sort keys for consistent serialization
  const content = JSON.stringify(obj, Object.keys(obj as object).sort());
  const hash = await sha256(content);
  
  return {
    hash,
    size: new TextEncoder().encode(content).length,
    timestamp: Date.now(),
  };
}

/**
 * Generate a short hash for display purposes
 */
export function shortHash(hash: string, length: number = 8): string {
  return hash.substring(0, length);
}

/**
 * Validate a hash string format
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

/**
 * Content-Addressable Key generator
 */
export function casKey(prefix: string, hash: string): string {
  return `${prefix}:sha256:${hash}`;
}

/**
 * Parse a CAS key back to hash
 */
export function parseCasKey(key: string): { prefix: string; hash: string } | null {
  const match = key.match(/^(.+):sha256:([a-f0-9]{64})$/);
  if (!match) return null;
  return { prefix: match[1], hash: match[2] };
}
