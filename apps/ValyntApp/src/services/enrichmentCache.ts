/**
 * Enrichment Cache — database-backed cache for enrichment API results.
 *
 * Provides get/set/invalidate helpers with configurable TTL.
 * The cache key is the normalized (lowercase, trimmed) company name.
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { enrichmentCache } from "../drizzle/schema";

// ── Configuration ────────────────────────────────────────────────────────────

/** Default TTL in milliseconds — 24 hours */
export const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Minimum confidence score to cache a result (skip caching low-quality results) */
const MIN_CACHEABLE_CONFIDENCE = 20;

// ── Key normalization ────────────────────────────────────────────────────────

/** Normalize a company name into a stable cache key */
export function normalizeCacheKey(companyName: string): string {
  return companyName.toLowerCase().trim().replace(/\s+/g, " ");
}

// ── Cache metadata returned to the frontend ──────────────────────────────────

export interface CacheMeta {
  /** Whether this result came from the cache */
  cached: boolean;
  /** When the cached result was originally enriched (ISO string) */
  cachedAt: string | null;
  /** Age of the cache entry in milliseconds */
  cacheAgeMs: number;
  /** How many times this entry has been served from cache */
  hitCount: number;
  /** TTL in milliseconds */
  ttlMs: number;
  /** Whether the cache entry is stale (age > TTL) */
  stale: boolean;
}

// ── Get ──────────────────────────────────────────────────────────────────────

/**
 * Look up a cached enrichment result by company name.
 * Returns the cached data + metadata if found and within TTL, or null if miss/stale.
 *
 * @param companyName - The company name to look up
 * @param ttlMs - TTL in milliseconds (default: 24h)
 * @returns The cached enrichment data and cache metadata, or null
 */
export async function getCachedEnrichment(
  companyName: string,
  ttlMs: number = DEFAULT_CACHE_TTL_MS
): Promise<{ data: Record<string, unknown>; meta: CacheMeta } | null> {
  const db = await getDb();
  if (!db) return null;

  const key = normalizeCacheKey(companyName);

  try {
    const rows = await db
      .select()
      .from(enrichmentCache)
      .where(eq(enrichmentCache.companyKey, key))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    const refreshedAt = new Date(row.refreshedAt).getTime();
    const ageMs = Date.now() - refreshedAt;
    const stale = ageMs > ttlMs;

    if (stale) {
      // Entry exists but is expired — treat as a miss
      return null;
    }

    // Cache hit — increment hit count and update lastHitAt
    await db
      .update(enrichmentCache)
      .set({
        hitCount: sql`${enrichmentCache.hitCount} + 1`,
        lastHitAt: new Date(),
      })
      .where(eq(enrichmentCache.id, row.id));

    return {
      data: row.data as Record<string, unknown>,
      meta: {
        cached: true,
        cachedAt: row.refreshedAt.toISOString(),
        cacheAgeMs: ageMs,
        hitCount: row.hitCount + 1,
        ttlMs,
        stale: false,
      },
    };
  } catch (err) {
    console.error("[EnrichmentCache] Get failed:", err);
    return null;
  }
}

// ── Set ──────────────────────────────────────────────────────────────────────

/**
 * Store an enrichment result in the cache.
 * Uses upsert (INSERT ... ON DUPLICATE KEY UPDATE) to handle both new and refresh cases.
 *
 * @param companyName - The original company name
 * @param data - The full enrichment response object
 * @param confidence - Confidence score (0-100)
 * @param sourcesSucceeded - Number of successful sources
 * @param totalLatencyMs - Total enrichment latency in ms
 */
export async function setCachedEnrichment(
  companyName: string,
  data: Record<string, unknown>,
  confidence: number,
  sourcesSucceeded: number,
  totalLatencyMs: number
): Promise<void> {
  // Don't cache very low-confidence results
  if (confidence < MIN_CACHEABLE_CONFIDENCE) {
    console.log(`[EnrichmentCache] Skipping cache for "${companyName}" — confidence ${confidence}% below threshold`);
    return;
  }

  const db = await getDb();
  if (!db) return;

  const key = normalizeCacheKey(companyName);

  try {
    await db
      .insert(enrichmentCache)
      .values({
        companyKey: key,
        companyName,
        data,
        confidence,
        sourcesSucceeded,
        totalLatencyMs,
        hitCount: 0,
        refreshedAt: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          companyName,
          data,
          confidence,
          sourcesSucceeded,
          totalLatencyMs,
          hitCount: 0,
          refreshedAt: new Date(),
        },
      });

    console.log(`[EnrichmentCache] Cached enrichment for "${companyName}" (${confidence}% confidence, ${sourcesSucceeded} sources, ${totalLatencyMs}ms)`);
  } catch (err) {
    console.error("[EnrichmentCache] Set failed:", err);
  }
}

// ── Invalidate ───────────────────────────────────────────────────────────────

/**
 * Invalidate (delete) a cached enrichment result.
 *
 * @param companyName - The company name to invalidate
 * @returns true if a row was deleted, false otherwise
 */
export async function invalidateCachedEnrichment(companyName: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const key = normalizeCacheKey(companyName);

  try {
    const result = await db
      .delete(enrichmentCache)
      .where(eq(enrichmentCache.companyKey, key));

    const deleted = (result as any)?.[0]?.affectedRows > 0;
    if (deleted) {
      console.log(`[EnrichmentCache] Invalidated cache for "${companyName}"`);
    }
    return deleted;
  } catch (err) {
    console.error("[EnrichmentCache] Invalidate failed:", err);
    return false;
  }
}

// ── Stats ────────────────────────────────────────────────────────────────────

/**
 * Get cache statistics (total entries, total hits, average confidence).
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalHits: number;
  avgConfidence: number;
} | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select({
        totalEntries: sql<number>`COUNT(*)`,
        totalHits: sql<number>`COALESCE(SUM(${enrichmentCache.hitCount}), 0)`,
        avgConfidence: sql<number>`COALESCE(AVG(${enrichmentCache.confidence}), 0)`,
      })
      .from(enrichmentCache);

    return result[0] ?? { totalEntries: 0, totalHits: 0, avgConfidence: 0 };
  } catch (err) {
    console.error("[EnrichmentCache] Stats failed:", err);
    return null;
  }
}
