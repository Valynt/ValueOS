import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadContent,
  loadContentFromApi,
  loadContentFromJson,
} from './content-loader';

const validPayload = {
  modules: [
    {
      id: 'module-1',
      title: 'Module 1',
      description: 'Description',
      pillarId: 1,
      order: 1,
      requiredMaturityLevel: 0,
      estimatedDuration: '1 hour',
      prerequisites: [],
      skills: ['discovery'],
      resources: ['resource-1'],
    },
  ],
  resources: [{ id: 'resource-1' }],
  version: '1.2.3',
};

describe('content-loader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('loads JSON content and caches repeated fetches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => validPayload,
    } as Response);

    vi.stubGlobal('fetch', fetchMock);

    const first = await loadContentFromJson('/content/curriculum.json');
    const second = await loadContentFromJson('/content/curriculum.json');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.modules).toHaveLength(1);
    expect(second.metadata.version).toBe('1.2.3');
  });

  it('retries API requests and normalizes nested payload shape', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 502 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { curriculum: validPayload } }),
      } as Response);

    vi.stubGlobal('fetch', fetchMock);

    const promise = loadContentFromApi('/api/curriculum', { pillarId: 4, role: 'sales' });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.modules[0]?.id).toBe('module-1');
    expect(result.metadata.source).toBe('/api/curriculum');
  });

  it('throws after API retries are exhausted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      } as Response),
    );

    const promise = expect(loadContentFromApi('/api/unavailable')).rejects.toThrow('after 3 attempts');
    await vi.runAllTimersAsync();
    await promise;
  });

  it('throws on invalid JSON payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ modules: [{ id: 'missing-fields' }] }),
      } as Response),
    );

    await expect(loadContentFromJson('/content/invalid.json')).rejects.toThrow('Invalid content payload');
  });

  it('uses source strategy from options for main loader', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => validPayload,
      } as Response),
    );

    const result = await loadContent({ source: 'json', path: '/content/curriculum.json' });

    expect(result.modules).toHaveLength(1);
  });
});
