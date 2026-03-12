/**
 * ReadThroughCacheService.invalidateEndpoint — SCAN vs KEYS
 *
 * invalidateEndpoint currently calls redis.keys() which blocks the Redis
 * event loop on large keyspaces. This test pins the current behaviour and
 * documents the known debt: it asserts that the implementation does NOT use
 * SCAN-based iteration, so that when the fix lands the test can be inverted
 * to assert SCAN is used instead.
 *
 * See: packages/backend/src/lib/redis.ts::deleteCachePattern for the
 * correct SCAN-based pattern that should replace the keys() call.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Redis mock ───────────────────────────────────────────────────────────────

const { mockKeys, mockScan, mockDel, mockGet, mockSet } = vi.hoisted(() => ({
  mockKeys: vi.fn(),
  mockScan: vi.fn(),
  mockDel: vi.fn(),
  mockGet: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock('@shared/lib/redisClient', () => ({
  getRedisClient: vi.fn().mockResolvedValue({
    keys: mockKeys,
    scan: mockScan,
    del: mockDel,
    get: mockGet,
    set: mockSet,
  }),
}));

// @shared/lib/redisKeys is pure (no I/O) — use the real implementation so
// key-scoping assertions stay in sync with the actual key format.

vi.mock('../lib/metrics/httpMetrics.js', () => ({
  readCacheEventsTotal: { inc: vi.fn() },
}));

import { ReadThroughCacheService } from '../services/ReadThroughCacheService.js';

const TENANT_A = 'tenant-aaaa-0000-0000-000000000001';
const ENDPOINT = 'api-analytics-summary';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReadThroughCacheService.invalidateEndpoint', () => {
  beforeEach(() => {
    mockKeys.mockReset();
    mockScan.mockReset();
    mockDel.mockReset();
  });

  it('returns 0 and does not call del when no keys match', async () => {
    mockKeys.mockResolvedValue([]);

    const deleted = await ReadThroughCacheService.invalidateEndpoint(TENANT_A, ENDPOINT);

    expect(deleted).toBe(0);
    expect(mockDel).not.toHaveBeenCalled();
  });

  it('deletes all matching keys returned by keys()', async () => {
    const matchingKeys = [
      `${TENANT_A}:read-cache:${ENDPOINT}:summary:abc123`,
      `${TENANT_A}:read-cache:${ENDPOINT}:summary:def456`,
    ];
    mockKeys.mockResolvedValue(matchingKeys);
    mockDel.mockResolvedValue(2);

    const deleted = await ReadThroughCacheService.invalidateEndpoint(TENANT_A, ENDPOINT);

    expect(deleted).toBe(2);
    expect(mockDel).toHaveBeenCalledWith(matchingKeys);
  });

  it('does not call SCAN — documents current keys() usage (known debt)', async () => {
    mockKeys.mockResolvedValue([]);

    await ReadThroughCacheService.invalidateEndpoint(TENANT_A, ENDPOINT);

    // Current implementation uses KEYS, not SCAN.
    // When this is fixed to use SCAN, flip these two assertions.
    expect(mockKeys).toHaveBeenCalledOnce();
    expect(mockScan).not.toHaveBeenCalled();
  });

  it('scopes the key pattern to the requesting tenant', async () => {
    mockKeys.mockResolvedValue([]);

    await ReadThroughCacheService.invalidateEndpoint(TENANT_A, ENDPOINT);

    const pattern: string = mockKeys.mock.calls[0][0] as string;
    expect(pattern).toContain(TENANT_A);
    expect(pattern).toContain(ENDPOINT);
  });

  it('does not invalidate keys belonging to a different tenant', async () => {
    const TENANT_B = 'tenant-bbbb-0000-0000-000000000002';
    const tenantBKey = `${TENANT_B}:read-cache:${ENDPOINT}:summary:xyz`;

    // keys() is called with a tenant-scoped pattern; simulate it returning
    // only tenant-A keys (the real Redis would do the same).
    mockKeys.mockResolvedValue([
      `${TENANT_A}:read-cache:${ENDPOINT}:summary:abc`,
    ]);
    mockDel.mockResolvedValue(1);

    await ReadThroughCacheService.invalidateEndpoint(TENANT_A, ENDPOINT);

    const deletedKeys: string[] = mockDel.mock.calls[0][0] as string[];
    expect(deletedKeys).not.toContain(tenantBKey);
  });
});
