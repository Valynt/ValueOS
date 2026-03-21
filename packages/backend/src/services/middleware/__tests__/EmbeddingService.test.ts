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
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

// Mock the TogetherClient singleton so tests don't need a real API key
const mockEmbeddingsCreate = vi.fn();
vi.mock('../../../lib/agent-fabric/TogetherClient.js', () => ({
  getTogetherClient: () => ({
    embeddings: { create: mockEmbeddingsCreate },
  }),
}));

// Mock ModelRegistry alias resolution
vi.mock('../../../lib/agent-fabric/ModelRegistry.js', () => ({
  resolveAlias: () => ({ modelId: 'togethercomputer/m2-bert-80M-8k-retrieval' }),
  getCapabilities: vi.fn(),
  assertModelAllowed: vi.fn(),
  getActiveModelIds: vi.fn(() => []),
  ModelDeniedError: class ModelDeniedError extends Error {},
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  const fakeEmbedding = Array.from({ length: 768 }, (_, i) => i * 0.001);

  beforeEach(() => {
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: fakeEmbedding, index: 0, object: 'embedding' }],
      model: 'togethercomputer/m2-bert-80M-8k-retrieval',
      object: 'list',
    });

    service = new EmbeddingService({
      cacheMaxSize: 5,
      cacheTtlMs: 60_000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('generates an embedding via Together AI SDK', async () => {
    const result = await service.generateEmbedding('test query');
    expect(result).toEqual(fakeEmbedding);
    expect(mockEmbeddingsCreate).toHaveBeenCalledOnce();
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      model: 'togethercomputer/m2-bert-80M-8k-retrieval',
      input: 'test query',
    });
  });

  it('returns cached result on second call with same text', async () => {
    await service.generateEmbedding('test query');
    const result = await service.generateEmbedding('test query');
    expect(result).toEqual(fakeEmbedding);
    expect(mockEmbeddingsCreate).toHaveBeenCalledOnce(); // Only one API call
  });

  it('normalizes cache keys (case-insensitive, trimmed)', async () => {
    await service.generateEmbedding('  Test Query  ');
    const result = await service.generateEmbedding('test query');
    expect(result).toEqual(fakeEmbedding);
    expect(mockEmbeddingsCreate).toHaveBeenCalledOnce();
  });

  it('evicts oldest entry when cache is full', async () => {
    // Fill cache (maxSize = 5)
    for (let i = 0; i < 5; i++) {
      mockEmbeddingsCreate.mockResolvedValueOnce({
        data: [{ embedding: [i], index: 0, object: 'embedding' }],
        model: 'togethercomputer/m2-bert-80M-8k-retrieval',
        object: 'list',
      });
      await service.generateEmbedding(`query ${i}`);
    }
    expect(service.getCacheSize()).toBe(5);

    // Add one more — should evict "query 0"
    mockEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: [99], index: 0, object: 'embedding' }],
      model: 'togethercomputer/m2-bert-80M-8k-retrieval',
      object: 'list',
    });
    await service.generateEmbedding('query 5');
    expect(service.getCacheSize()).toBe(5);

    // "query 0" should be evicted — fetching it again should trigger an API call
    mockEmbeddingsCreate.mockResolvedValueOnce({
      data: [{ embedding: [0], index: 0, object: 'embedding' }],
      model: 'togethercomputer/m2-bert-80M-8k-retrieval',
      object: 'list',
    });
    await service.generateEmbedding('query 0');
    // Total calls: 5 (initial) + 1 (query 5) + 1 (query 0 re-fetch) = 7
    expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(7);
  });

  it('throws on SDK error', async () => {
    mockEmbeddingsCreate.mockRejectedValueOnce(
      new Error('Together AI embedding API error: 500 Internal Server Error')
    );

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
