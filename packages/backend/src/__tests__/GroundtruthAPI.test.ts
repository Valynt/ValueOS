import { afterEach, describe, expect, it, vi } from 'vitest';

/* eslint-disable security/detect-object-injection -- Test file using controlled environment variable access */

vi.mock('@shared/lib/env', () => ({
  getEnvVar: (key: string) => process.env[key],
  setEnvVar: (key: string, value: string) => {
    process.env[key] = value;
  },
  getSupabaseConfig: () => ({ url: '', anonKey: '' }),
  getLLMCostTrackerConfig: () => ({ supabaseUrl: '', supabaseKey: '', tableName: 'llm_costs' }),
  __setEnvSourceForTests: (envSource: Record<string, string>) => Object.assign(process.env, envSource),
  checkIsBrowser: () => false,
  getGroundtruthConfig: () => {
    const apiKey = process.env.VITE_GROUNDTRUTH_API_KEY || process.env.GROUNDTRUTH_API_KEY;
    return {
      baseUrl:
        process.env.VITE_GROUNDTRUTH_URL ||
        process.env.GROUNDTRUTH_URL ||
        'https://api.groundtruth.example.com',
      timeout: Number(process.env.GROUNDTRUTH_TIMEOUT || '30000'),
      ...(apiKey ? { apiKey } : {}),
    };
  },
}));


vi.mock('../services/post-v1/ExternalCircuitBreaker.js', () => ({
  ExternalCircuitBreaker: class {
    execute<T>(
      _key: string,
      operation: () => Promise<T>,
      _options?: { fallback?: (error: Error, state: string) => Promise<T> }
    ): Promise<T> {
      return operation();
    }

    getMetrics(): Record<string, never> {
      return {};
    }
  },
}));

import { GroundtruthAPI } from '../services/domain-packs/GroundtruthAPI';

const ORIGINAL_GROUNDTRUTH_URL = process.env.GROUNDTRUTH_URL;
const ORIGINAL_VITE_GROUNDTRUTH_URL = process.env.VITE_GROUNDTRUTH_URL;

function resetGroundtruthEnv(): void {
  if (ORIGINAL_GROUNDTRUTH_URL === undefined) {
    delete process.env.GROUNDTRUTH_URL;
  } else {
    process.env.GROUNDTRUTH_URL = ORIGINAL_GROUNDTRUTH_URL;
  }

  if (ORIGINAL_VITE_GROUNDTRUTH_URL === undefined) {
    delete process.env.VITE_GROUNDTRUTH_URL;
  } else {
    process.env.VITE_GROUNDTRUTH_URL = ORIGINAL_VITE_GROUNDTRUTH_URL;
  }
}

describe('GroundtruthAPI', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetGroundtruthEnv();
  });

  it.each([
    ['GROUNDTRUTH_URL', 'https://groundtruth.internal.example'],
    ['VITE_GROUNDTRUTH_URL', 'https://groundtruth.vite.example'],
  ])('getDefaultConfig uses %s to populate config.baseUrl', async (envKey, envValue) => {
    delete process.env.GROUNDTRUTH_URL;
    delete process.env.VITE_GROUNDTRUTH_URL;
    process.env[envKey] = envValue;

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const api = new GroundtruthAPI();
    await api.evaluate({ query: 'health-check' });

    expect(api.isConfigured()).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${envValue}/evaluate`);
  });

  it('evaluate does not return URL-not-configured error when env vars are present', async () => {
    process.env.GROUNDTRUTH_URL = 'https://groundtruth.env.example';
    delete process.env.VITE_GROUNDTRUTH_URL;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const api = new GroundtruthAPI();
    const result = await api.evaluate({ query: 'validate' });

    expect(result.success).toBe(true);
    expect(result.error).not.toBe('Groundtruth API URL is not configured');
  });
});
