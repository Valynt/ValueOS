
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheService } from '../CacheService.js'

// Mock redis
const mockDel = vi.fn().mockResolvedValue(1);
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();
const mockGet = vi.fn().mockResolvedValue(null);
const mockSetEx = vi.fn().mockResolvedValue('OK');
const mockKeys = vi.fn().mockResolvedValue([]);

vi.mock('redis', () => {
  return {
    createClient: vi.fn(() => ({
      on: mockOn,
      connect: mockConnect,
      get: mockGet,
      setEx: mockSetEx,
      del: mockDel,
      keys: mockKeys,
    })),
  };
});

describe('CacheService deleteMany Optimization', () => {
  let cacheService: CacheService;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup environment for Redis
    vi.stubGlobal('window', undefined); // Ensure it thinks it's server-side
    process.env.REDIS_URL = 'redis://localhost:6379';

    // We need to force CacheService to initialize Redis.
    // It does so in constructor, but async part (connect) is not awaited.
    cacheService = new CacheService();

    // We wait a bit or access the private promise?
    // Actually initializeRedis is fire-and-forget in constructor.
    // But since we mock connect to resolve immediately, the client object is assigned synchronously.
    // However, we should make sure we are testing against the 'redis' storage.
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should call redis del once with array of keys when deleting many from redis', async () => {
    const keys = ['key1', 'key2', 'key3'];
    const namespace = 'test';
    // Logic in CacheService constructs full keys: `${namespace}:${key}`
    const fullKeys = keys.map(k => `${namespace}:${k}`);

    await cacheService.deleteMany(keys, {
      storage: 'redis',
      namespace
    });

    // Current implementation: Calls del for each key (3 times)
    // Optimized implementation: Calls del once with array

    // To verify the baseline (failure), we expect it to be called 3 times now?
    // No, the plan says "assert that deleteMany calls redisClient.del exactly once".
    // So this test SHOULD FAIL right now.

    expect(mockDel).toHaveBeenCalledTimes(1);
    expect(mockDel).toHaveBeenCalledWith(fullKeys);
  });
});
