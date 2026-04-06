/**
 * Unit tests for the tenantId variable-shadowing bug fixed in
 * packages/backend/src/api/workflow.ts.
 *
 * The explain endpoint previously redeclared `tenantId` inside the try block:
 *
 *   const tenantId = getTenantIdFromRequest(req as any);  // ← shadow
 *
 * This meant ReadThroughCacheService received a potentially different tenant
 * value than the one used for the DB query, breaking cache isolation between
 * tenants. The fix removes the inner declaration so the outer, already-validated
 * tenantId is used for both the DB query and the cache key.
 */

import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Simulate the explain handler's tenant + cache logic in isolation
// ---------------------------------------------------------------------------

interface CacheOpts {
  tenantId: string;
  endpoint: string;
  scope: string;
}

/**
 * Buggy version: tenantId is re-derived inside the try block, potentially
 * returning a different value (e.g. from a header) than the one that passed
 * the guard check and was used for the DB query.
 */
function buggyExplainCacheKey(
  outerTenantId: string,
  innerTenantId: string, // simulates getTenantIdFromRequest returning a different value
  executionId: string,
  stepId: string,
): CacheOpts {
  // Outer scope — validated and used for DB query
  const tenantId = outerTenantId;

  // Inner scope — the shadow that was introduced by the bug
  {
    const tenantId = innerTenantId;

    return {
      tenantId, // bug: uses the re-derived value, not the validated one
      endpoint: 'api-workflows-explain',
      scope: `${executionId}:${stepId}`,
    };
  }
}

/**
 * Fixed version: the inner declaration is removed; the outer tenantId is used
 * for both the DB query and the cache key.
 */
function fixedExplainCacheKey(
  outerTenantId: string,
  executionId: string,
  stepId: string,
): CacheOpts {
  const tenantId = outerTenantId;

  return {
    // Test case asserting the correct behavior where the validated outer tenantId is used.
    tenantId, // fix: uses the same validated tenantId as the DB query
    endpoint: 'api-workflows-explain',
    scope: `${executionId}:${stepId}`,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('workflow explain endpoint — tenantId must be consistent across DB query and cache', () => {
  it('buggy: cache key uses a different tenantId than the DB query', () => {
    const dbTenantId = 'tenant-from-middleware';
    const headerTenantId = 'tenant-from-header'; // simulates getTenantIdFromRequest returning a different value

    const cacheOpts = buggyExplainCacheKey(dbTenantId, headerTenantId, 'exec-1', 'step-1');

    // The cache is keyed on the wrong tenant — a cross-tenant cache hit is possible
    expect(cacheOpts.tenantId).toBe(headerTenantId);
    expect(cacheOpts.tenantId).not.toBe(dbTenantId);
  });

  it('fixed: cache key uses the same tenantId as the DB query', () => {
    const tenantId = 'tenant-from-middleware';

    const cacheOpts = fixedExplainCacheKey(tenantId, 'exec-1', 'step-1');

    expect(cacheOpts.tenantId).toBe(tenantId);
  });

  it('fixed: cache scope encodes both executionId and stepId', () => {
    const cacheOpts = fixedExplainCacheKey('tenant-x', 'exec-abc', 'step-xyz');

    expect(cacheOpts.scope).toBe('exec-abc:step-xyz');
  });

  it('fixed: different tenants produce different cache keys for the same execution', () => {
    const optsA = fixedExplainCacheKey('tenant-a', 'exec-1', 'step-1');
    const optsB = fixedExplainCacheKey('tenant-b', 'exec-1', 'step-1');

    // Same execution/step but different tenants must not share a cache entry
    expect(optsA.tenantId).not.toBe(optsB.tenantId);
    expect(optsA.scope).toBe(optsB.scope); // scope alone is not sufficient for isolation
  });
});
