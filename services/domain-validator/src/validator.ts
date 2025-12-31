/**
 * Domain validation service
 * Combines caching and database queries for fast domain verification
 */

import { domainCache } from './cache';
import { domainDatabase } from './database';
import { logger } from './logger';

export class DomainValidator {
  /**
   * Validate domain format
   */
  private isValidDomainFormat(domain: string): boolean {
    // Basic domain validation regex
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    return domainRegex.test(domain);
  }

  /**
   * Normalize domain (lowercase, trim)
   */
  private normalizeDomain(domain: string): string {
    return domain.toLowerCase().trim();
  }

  /**
   * Verify if a domain is valid and verified
   * Uses cache for fast lookups, falls back to database
   */
  async verifyDomain(domain: string): Promise<{
    verified: boolean;
    cached: boolean;
    duration: number;
  }> {
    const startTime = Date.now();

    // Normalize domain
    const normalizedDomain = this.normalizeDomain(domain);

    // Validate format
    if (!this.isValidDomainFormat(normalizedDomain)) {
      logger.warn('Invalid domain format', { domain: normalizedDomain });
      return {
        verified: false,
        cached: false,
        duration: Date.now() - startTime,
      };
    }

    // Check cache first
    const cachedResult = domainCache.get(normalizedDomain);
    if (cachedResult !== null) {
      return {
        verified: cachedResult,
        cached: true,
        duration: Date.now() - startTime,
      };
    }

    // Query database
    try {
      const verified = await domainDatabase.isDomainVerified(normalizedDomain);

      // Cache the result
      domainCache.set(normalizedDomain, verified);

      return {
        verified,
        cached: false,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Domain verification failed', {
        domain: normalizedDomain,
        error: error instanceof Error ? error.message : String(error),
      });

      // On error, cache negative result for shorter time (1 minute)
      // This prevents hammering the database on errors
      domainCache.set(normalizedDomain, false);

      return {
        verified: false,
        cached: false,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get validator statistics
   */
  async getStats(): Promise<{
    cacheSize: number;
    cacheMaxSize: number;
    cacheTtlSeconds: number;
    verifiedDomainsCount: number;
  }> {
    const cacheStats = domainCache.getStats();
    const verifiedDomainsCount = await domainDatabase.getVerifiedDomainsCount();

    return {
      cacheSize: cacheStats.size,
      cacheMaxSize: cacheStats.maxSize,
      cacheTtlSeconds: cacheStats.ttlSeconds,
      verifiedDomainsCount,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): number {
    return domainCache.clear();
  }
}

// Singleton instance
export const domainValidator = new DomainValidator();
