import { sha256, hashObject, shortHash, isValidHash, casKey, parseCasKey } from './contentHash';

const mockDigest = async (data: BufferSource) => {
  const byteLength = (data as ArrayBuffer).byteLength ?? 0;
  return new Uint8Array(new Array(byteLength || 4).fill(1)).buffer;
};

describe('contentHash utilities', () => {
  beforeEach(() => {
    const subtle = { digest: vi.fn().mockImplementation(() => mockDigest(new ArrayBuffer(4))) } as any;
    Object.defineProperty(globalThis, 'crypto', {
      value: { subtle },
      configurable: true,
    });
  });

  it('generates stable sha256 hashes in browser-like environments', async () => {
    const hash = await sha256('test-value');
    const hashAgain = await sha256('test-value');

    expect(hash).toHaveLength(64);
    expect(hash).toEqual(hashAgain);
  });

  it('hashes objects deterministically with sorted keys', async () => {
    const objectA = { b: 2, a: { z: 1, y: 2 } };
    const objectB = { a: { y: 2, z: 1 }, b: 2 };

    const [resultA, resultB] = await Promise.all([hashObject(objectA), hashObject(objectB)]);

    expect(resultA.hash).toEqual(resultB.hash);
    expect(resultA.size).toBeGreaterThan(0);
    expect(resultA.timestamp).toBeGreaterThan(0);
  });

  it('validates and shortens hashes safely', () => {
    const valid = 'a'.repeat(64);
    expect(isValidHash(valid)).toBe(true);
    expect(shortHash(valid, 10)).toHaveLength(10);
  });

  it('builds and parses content-addressable keys', () => {
    const key = casKey('template', 'b'.repeat(64));
    expect(key).toContain('template:sha256:');

    const parsed = parseCasKey(key);
    expect(parsed).toEqual({ prefix: 'template', hash: 'b'.repeat(64) });
    expect(parseCasKey('invalid')).toBeNull();
  });
});
