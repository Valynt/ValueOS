import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddingService } from '../EmbeddingService.js';

// Mock logger
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockFetch: ReturnType<typeof vi.fn>;

  const fakeEmbedding = Array.from({ length: 768 }, (_, i) => i * 0.001);

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ embedding: fakeEmbedding }] }),
    });
    global.fetch = mockFetch as any;

    service = new EmbeddingService({
      apiKey: 'test-key',
      cacheMaxSize: 5,
      cacheTtlMs: 60_000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates an embedding via Together AI', async () => {
    const result = await service.generateEmbedding('test query');
    expect(result).toEqual(fakeEmbedding);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.together.xyz/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
  });

  it('returns cached result on second call with same text', async () => {
    await service.generateEmbedding('test query');
    const result = await service.generateEmbedding('test query');
    expect(result).toEqual(fakeEmbedding);
    expect(mockFetch).toHaveBeenCalledOnce(); // Only one API call
  });

  it('normalizes cache keys (case-insensitive, trimmed)', async () => {
    await service.generateEmbedding('  Test Query  ');
    const result = await service.generateEmbedding('test query');
    expect(result).toEqual(fakeEmbedding);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('evicts oldest entry when cache is full', async () => {
    // Fill cache (maxSize = 5)
    for (let i = 0; i < 5; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ embedding: [i] }] }),
      });
      await service.generateEmbedding(`query ${i}`);
    }
    expect(service.getCacheSize()).toBe(5);

    // Add one more — should evict "query 0"
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ embedding: [99] }] }),
    });
    await service.generateEmbedding('query 5');
    expect(service.getCacheSize()).toBe(5);

    // "query 0" should be evicted — fetching it again should trigger an API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ embedding: [0] }] }),
    });
    await service.generateEmbedding('query 0');
    // Total calls: 5 (initial) + 1 (query 5) + 1 (query 0 re-fetch) = 7
    expect(mockFetch).toHaveBeenCalledTimes(7);
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(service.generateEmbedding('fail')).rejects.toThrow(
      'Together AI embedding API error: 500'
    );
  });

  it('clearCache empties the cache', async () => {
    await service.generateEmbedding('test');
    expect(service.getCacheSize()).toBe(1);
    service.clearCache();
    expect(service.getCacheSize()).toBe(0);
  });
});
