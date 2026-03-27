// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueryInstrumentationEvent, QueryInstrumentationHook } from './supabase';

const createClientMock = vi.fn(
  (_url: string, _key: string, options?: { global?: { fetch?: typeof fetch } }) => ({
    __options: options,
  }),
);

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

vi.mock('./env', () => ({
  getSupabaseConfig: () => ({
    url: 'https://test.supabase.co',
    anonKey: 'anon-key',
    serviceRoleKey: 'service-key',
  }),
}));

async function loadModule() {
  vi.resetModules();
  createClientMock.mockClear();
  return import('./supabase');
}

/** Minimal fetch response without using the Response constructor (not available in node env). */
function makeResponse(status: number): { status: number } {
  return { status };
}

describe('Supabase query instrumentation hook', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('calls the hook with ok status on a successful query', async () => {
    const { createServiceRoleSupabaseClient, setQueryInstrumentationHook } = await loadModule();

    const hook = vi.fn<[QueryInstrumentationEvent], void>();
    setQueryInstrumentationHook(hook);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeResponse(200));

    createServiceRoleSupabaseClient();
    const fetchImpl = createClientMock.mock.calls.at(-1)?.[2]?.global?.fetch;
    expect(fetchImpl).toBeDefined();

    await fetchImpl!(
      'https://test.supabase.co/rest/v1/vg_capabilities?select=*',
      { method: 'GET' },
    );

    expect(hook).toHaveBeenCalledOnce();
    const event = hook.mock.calls[0][0];
    expect(event.status).toBe('ok');
    expect(event.table).toBe('vg_capabilities');
    expect(event.operation).toBe('select');
    expect(event.duration_ms).toBeGreaterThanOrEqual(0);
    expect(event.http_status).toBe(200);

    setQueryInstrumentationHook(null);
  });

  it('calls the hook with error status on a 4xx response', async () => {
    const { createServiceRoleSupabaseClient, setQueryInstrumentationHook } = await loadModule();

    const hook = vi.fn<[QueryInstrumentationEvent], void>();
    setQueryInstrumentationHook(hook);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeResponse(404));

    createServiceRoleSupabaseClient();
    const fetchImpl = createClientMock.mock.calls.at(-1)?.[2]?.global?.fetch;

    await fetchImpl!(
      'https://test.supabase.co/rest/v1/promise_kpi_targets',
      { method: 'POST' },
    );

    expect(hook).toHaveBeenCalledOnce();
    const event = hook.mock.calls[0][0];
    expect(event.status).toBe('error');
    expect(event.table).toBe('promise_kpi_targets');
    expect(event.operation).toBe('insert');
    expect(event.http_status).toBe(404);

    setQueryInstrumentationHook(null);
  });

  it('calls the hook with error status when fetch throws', async () => {
    const { createServiceRoleSupabaseClient, setQueryInstrumentationHook } = await loadModule();

    const hook = vi.fn<[QueryInstrumentationEvent], void>();
    setQueryInstrumentationHook(hook);

    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network failure'));

    createServiceRoleSupabaseClient();
    const fetchImpl = createClientMock.mock.calls.at(-1)?.[2]?.global?.fetch;

    await expect(
      fetchImpl!(
        'https://test.supabase.co/rest/v1/rpc/resolve_value_graph_node',
        { method: 'POST' },
      ),
    ).rejects.toThrow('Network failure');

    expect(hook).toHaveBeenCalledOnce();
    const event = hook.mock.calls[0][0];
    expect(event.status).toBe('error');
    expect(event.table).toBe('resolve_value_graph_node');
    expect(event.operation).toBe('rpc');

    setQueryInstrumentationHook(null);
  });

  it('does not call the hook when none is registered', async () => {
    const { createServiceRoleSupabaseClient, setQueryInstrumentationHook } = await loadModule();
    setQueryInstrumentationHook(null);

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeResponse(200));

    createServiceRoleSupabaseClient();
    const fetchImpl = createClientMock.mock.calls.at(-1)?.[2]?.global?.fetch;

    await expect(
      fetchImpl!('https://test.supabase.co/rest/v1/benchmarks', { method: 'GET' }),
    ).resolves.toBeDefined();
  });

  describe('URL parsing', () => {
    it('maps POST with Prefer: resolution=merge-duplicates -> upsert', async () => {
      const { createServiceRoleSupabaseClient, setQueryInstrumentationHook } = await loadModule();

      const hook = vi.fn<[QueryInstrumentationEvent], void>();
      setQueryInstrumentationHook(hook);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeResponse(200));

      createServiceRoleSupabaseClient();
      const fetchImpl = createClientMock.mock.calls.at(-1)?.[2]?.global?.fetch;

      await fetchImpl!(
        'https://test.supabase.co/rest/v1/benchmarks',
        { method: 'POST', headers: { 'Prefer': 'return=representation,resolution=merge-duplicates' } },
      );

      const event = hook.mock.calls[0][0];
      expect(event.table).toBe('benchmarks');
      expect(event.operation).toBe('upsert');

      setQueryInstrumentationHook(null);
    });

    it.each([
      ['GET',    '/rest/v1/vg_capabilities',               'vg_capabilities',           'select'],
      ['POST',   '/rest/v1/promise_kpi_targets',            'promise_kpi_targets',        'insert'],
      ['PATCH',  '/rest/v1/vg_metrics',                    'vg_metrics',                'update'],
      ['DELETE', '/rest/v1/vg_value_drivers',               'vg_value_drivers',           'delete'],
      ['POST',   '/rest/v1/rpc/resolve_value_graph_node',  'resolve_value_graph_node',   'rpc'],
    ] as const)('maps %s %s -> table=%s operation=%s', async (method, path, expectedTable, expectedOp) => {
      const { createServiceRoleSupabaseClient, setQueryInstrumentationHook } = await loadModule();

      const hook = vi.fn<[QueryInstrumentationEvent], void>();
      setQueryInstrumentationHook(hook);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeResponse(200));

      createServiceRoleSupabaseClient();
      const fetchImpl = createClientMock.mock.calls.at(-1)?.[2]?.global?.fetch;

      await fetchImpl!(`https://test.supabase.co${path}`, { method });

      const event = hook.mock.calls[0][0];
      expect(event.table).toBe(expectedTable);
      expect(event.operation).toBe(expectedOp);

      setQueryInstrumentationHook(null);
    });
  });
});
