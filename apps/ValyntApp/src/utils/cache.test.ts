import { cacheManager } from './cache';

// jsdom's sessionStorage/localStorage silently fail without a real origin.
// Provide in-memory replacements that expose stored keys as own enumerable
// properties so Object.keys(storage) works the same as a real Storage object.
function makeStorage(): Storage {
  const proxy = new Proxy({} as Storage, {
    get(target, prop: string) {
      if (prop === 'getItem') return (k: string) => (target as Record<string, string>)[k] ?? null;
      if (prop === 'setItem') return (k: string, v: string) => { (target as Record<string, string>)[k] = v; };
      if (prop === 'removeItem') return (k: string) => { delete (target as Record<string, string>)[k]; };
      if (prop === 'clear') return () => { Object.keys(target).forEach(k => delete (target as Record<string, string>)[k]); };
      if (prop === 'key') return (i: number) => Object.keys(target)[i] ?? null;
      if (prop === 'length') return Object.keys(target).length;
      return (target as Record<string, string>)[prop];
    },
    set(target, prop: string, value: string) {
      (target as Record<string, string>)[prop] = value;
      return true;
    },
    ownKeys(target) { return Object.keys(target); },
    getOwnPropertyDescriptor(target, prop: string) {
      if (prop in target) return { value: (target as Record<string, string>)[prop], writable: true, enumerable: true, configurable: true };
      return undefined;
    },
  });
  return proxy;
}

describe('cacheManager', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', makeStorage());
    vi.stubGlobal('localStorage', makeStorage());
    cacheManager.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00-05:00'));
  });

  afterEach(() => {
    cacheManager.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
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
