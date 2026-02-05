import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheService } from '../CacheService.js'
import { tenantContextStorage, TCTPayload } from '../../middleware/tenantContext.js'

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();

vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    on: mockOn,
    connect: mockConnect,
  })),
}));

describe('CacheService tenant scoping', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheService = new CacheService('app');
  });

  it('isolates cache keys by tenant context', async () => {
    const tenantA: TCTPayload = {
      iss: 'jwt',
      sub: 'user-a',
      tid: 'tenant-a',
      roles: [],
      tier: 'basic',
      exp: 1712345678,
    };
    const tenantB: TCTPayload = {
      iss: 'jwt',
      sub: 'user-b',
      tid: 'tenant-b',
      roles: [],
      tier: 'basic',
      exp: 1712345678,
    };

    await tenantContextStorage.run(tenantA, async () => {
      await cacheService.set('shared-key', 'tenant-a-value');
      const value = await cacheService.get<string>('shared-key');
      expect(value).toBe('tenant-a-value');
    });

    await tenantContextStorage.run(tenantB, async () => {
      const value = await cacheService.get<string>('shared-key');
      expect(value).toBeNull();
    });
  });

  it('rejects mismatched tenant namespaces', async () => {
    const tenantA: TCTPayload = {
      iss: 'jwt',
      sub: 'user-a',
      tid: 'tenant-a',
      roles: [],
      tier: 'basic',
      exp: 1712345678,
    };

    await tenantContextStorage.run(tenantA, async () => {
      await expect(
        cacheService.set('key', 'value', { namespace: 'tenant:tenant-b:app' })
      ).rejects.toThrow(/Tenant cache namespace mismatch/);
    });
  });
});
