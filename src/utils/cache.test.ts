import { cacheManager } from './cache';

describe('cacheManager', () => {
  beforeEach(() => {
    cacheManager.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00-05:00'));
  });

  afterEach(() => {
    cacheManager.clear();
    vi.useRealTimers();
  });

  it('stores and retrieves values with TTL', () => {
    cacheManager.set('key', 'value', { ttl: 1000 });

    expect(cacheManager.get('key')).toBe('value');

    vi.advanceTimersByTime(1500);

    expect(cacheManager.get('key')).toBeNull();
  });

  it('respects storage option and versioning', () => {
    cacheManager.set('session-key', { foo: 'bar' }, { storage: 'session', version: '1.0' });
    expect(cacheManager.get('session-key', { storage: 'session', version: '1.0' })).toEqual({ foo: 'bar' });

    // mismatched version invalidates entry
    expect(cacheManager.get('session-key', { storage: 'session', version: '2.0' })).toBeNull();
  });

  it('getOrSet caches factory result and avoids duplicate fetches', async () => {
    const factory = vi.fn().mockResolvedValue({ id: 1 });

    const first = await cacheManager.getOrSet('item', factory);
    const second = await cacheManager.getOrSet('item', factory);

    expect(first).toEqual({ id: 1 });
    expect(second).toEqual({ id: 1 });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('cleanExpired removes stale entries from all storages', () => {
    cacheManager.set('memory', 'value', { ttl: 10, storage: 'memory' });
    cacheManager.set('session', 'value', { ttl: 10, storage: 'session' });
    cacheManager.set('local', 'value', { ttl: 10, storage: 'local' });

    vi.advanceTimersByTime(20);

    const cleaned = cacheManager.cleanExpired();
    expect(cleaned).toBeGreaterThanOrEqual(3);
    expect(cacheManager.get('memory')).toBeNull();
  });
});
