import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockScan, mockDel } = vi.hoisted(() => ({
  mockScan: vi.fn(),
  mockDel: vi.fn(),
}));

const readCacheEventsTotalInc = vi.hoisted(() => vi.fn());

vi.mock('@shared/lib/redisClient', () => ({
  getRedisClient: vi.fn().mockResolvedValue({
    scan: mockScan,
    del: mockDel,
  }),
}));

vi.mock('../lib/metrics/httpMetrics.js', () => ({
  readCacheEventsTotal: { inc: readCacheEventsTotalInc },
}));

import { ReadThroughCacheService } from '../services/ReadThroughCacheService.js';

const TENANT_A = 'tenant-aaaa-0000-0000-000000000001';
const TENANT_B = 'tenant-bbbb-0000-0000-000000000002';
const ENDPOINT = 'api-analytics-summary';

describe('ReadThroughCacheService.invalidateEndpoint', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockDel.mockReset();
    readCacheEventsTotalInc.mockReset();
  });

  it('returns 0 and does not call del when no keys match', async () => {
    mockScan.mockResolvedValueOnce(['0', []]);

    const deleted = await ReadThroughCacheService.invalidateEndpoint(TENANT_A, ENDPOINT);

    expect(deleted).toBe(0);
    expect(mockDel).not.toHaveBeenCalled();
    expect(readCacheEventsTotalInc).not.toHaveBeenCalled();
  });

  it('iterates with SCAN until cursor is exhausted and deletes matching keys', async () => {
    const matchingKeys = [
      `${TENANT_A}:read-cache:${ENDPOINT}:summary:abc123`,
      `${TENANT_A}:read-cache:${ENDPOINT}:summary:def456`,
      `${TENANT_A}:read-cache:${ENDPOINT}:summary:ghi789`,
    ];

    mockScan
      .mockResolvedValueOnce(['17', matchingKeys.slice(0, 2)])
      .mockResolvedValueOnce(['0', matchingKeys.slice(2)]);

    mockDel.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const deleted = await ReadThroughCacheService.invalidateEndpoint(TENANT_A, ENDPOINT);

    expect(deleted).toBe(3);
    expect(mockScan).toHaveBeenCalledTimes(2);
    expect(mockScan).toHaveBeenNthCalledWith(1, '0', {
      MATCH: `${TENANT_A}:read-cache:${ENDPOINT}*`,
      COUNT: 100,
    });
    expect(mockScan).toHaveBeenNthCalledWith(2, '17', {
      MATCH: `${TENANT_A}:read-cache:${ENDPOINT}*`,
      COUNT: 100,
    });
    expect(mockDel).toHaveBeenNthCalledWith(1, matchingKeys.slice(0, 2));
    expect(mockDel).toHaveBeenNthCalledWith(2, matchingKeys.slice(2));
    expect(readCacheEventsTotalInc).toHaveBeenCalledWith(
      { endpoint: ENDPOINT, event: 'eviction' },
      3,
    );
  });

  it('supports high-cardinality invalidation without using KEYS', async () => {
    const batchOne = Array.from({ length: 100 }, (_, index) =>
      `${TENANT_A}:read-cache:${ENDPOINT}:summary:key-${index}`,
    );
    const batchTwo = Array.from({ length: 100 }, (_, index) =>
      `${TENANT_A}:read-cache:${ENDPOINT}:summary:key-${index + 100}`,
    );
    const batchThree = Array.from({ length: 57 }, (_, index) =>
      `${TENANT_A}:read-cache:${ENDPOINT}:summary:key-${index + 200}`,
    );

    mockScan
      .mockResolvedValueOnce(['1', batchOne])
      .mockResolvedValueOnce(['2', batchTwo])
      .mockResolvedValueOnce(['0', batchThree]);

    mockDel
      .mockResolvedValueOnce(batchOne.length)
      .mockResolvedValueOnce(batchTwo.length)
      .mockResolvedValueOnce(batchThree.length);

    const deleted = await ReadThroughCacheService.invalidateEndpoint(TENANT_A, ENDPOINT);

    expect(deleted).toBe(257);
    expect(mockScan).toHaveBeenCalledTimes(3);
    for (const call of mockScan.mock.calls) {
      expect(call[1]).toEqual({
        MATCH: `${TENANT_A}:read-cache:${ENDPOINT}*`,
        COUNT: 100,
      });
    }
    expect(readCacheEventsTotalInc).toHaveBeenCalledWith(
      { endpoint: ENDPOINT, event: 'eviction' },
      257,
    );
  });

  it('remains tenant-scoped via MATCH pattern', async () => {
    mockScan.mockResolvedValueOnce(['0', []]);

    await ReadThroughCacheService.invalidateEndpoint(TENANT_A, ENDPOINT);

    const options = mockScan.mock.calls[0]?.[1] as { MATCH: string; COUNT: number };
    expect(options.MATCH).toContain(TENANT_A);
    expect(options.MATCH).not.toContain(TENANT_B);
    expect(options.MATCH).toContain(ENDPOINT);
  });

  it('does not attempt deletion for empty batches from intermediate scan pages', async () => {
    mockScan
      .mockResolvedValueOnce(['33', []])
      .mockResolvedValueOnce(['0', [`${TENANT_A}:read-cache:${ENDPOINT}:summary:abc`]]);
    mockDel.mockResolvedValueOnce(1);

    const deleted = await ReadThroughCacheService.invalidateEndpoint(TENANT_A, ENDPOINT);

    expect(deleted).toBe(1);
    expect(mockDel).toHaveBeenCalledTimes(1);
    expect(readCacheEventsTotalInc).toHaveBeenCalledWith(
      { endpoint: ENDPOINT, event: 'eviction' },
      1,
    );
  });
});
