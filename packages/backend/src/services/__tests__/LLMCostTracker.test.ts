import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger.js';
import { LLMCostTracker } from '../LLMCostTracker';

type MockState = {
  filters: Array<{ op: string; column: string; value: unknown }>;
  insertCount: number;
  insertError: { message: string } | null;
  lastInsertPayload: Record<string, unknown> | null;
  lastSelectColumns: string | null;
  selectResponse: { data: any; error: any };
};

const state: MockState = {
  filters: [],
  insertCount: 0,
  insertError: null,
  lastInsertPayload: null,
  lastSelectColumns: null,
  selectResponse: { data: [], error: null },
};

vi.mock('@shared/lib/env', () => ({
  getEnvVar: (_name: string, options?: { defaultValue?: string }) => options?.defaultValue ?? null,
  getLLMCostTrackerConfig: () => ({
    supabaseUrl: 'http://localhost:54321',
    supabaseKey: 'anon-key',
    slackWebhookUrl: null,
    alertEmail: null,
  }),
  getSupabaseConfig: () => ({
    serviceRoleKey: 'service-role-key',
  }),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@supabase/supabase-js', () => {
  const buildQuery = () => {
    const query = {
      select: vi.fn((columns: string) => {
        state.lastSelectColumns = columns;
        return query;
      }),
      gte: vi.fn((column: string, value: unknown) => {
        state.filters.push({ op: 'gte', column, value });
        return query;
      }),
      lte: vi.fn((column: string, value: unknown) => {
        state.filters.push({ op: 'lte', column, value });
        return query;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        state.filters.push({ op: 'eq', column, value });
        return query;
      }),
      limit: vi.fn((_value: number) => query),
      then: (resolve: (value: any) => any, reject?: (reason: unknown) => any) =>
        Promise.resolve(state.selectResponse).then(resolve, reject),
    };
    return query;
  };

  const mockClient = {
    state,
    from: vi.fn((_table: string) => {
      const query = buildQuery();
      return {
        ...query,
        insert: vi.fn((payload: Record<string, unknown>) => {
          state.insertCount += 1;
          state.lastInsertPayload = payload;
          return Promise.resolve({ error: state.insertError });
        }),
      };
    }),
  };

  return {
    createClient: vi.fn(() => mockClient),
  };
});

describe('LLMCostTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.filters = [];
    state.insertCount = 0;
    state.insertError = null;
    state.lastInsertPayload = null;
    state.lastSelectColumns = null;
    state.selectResponse = { data: [], error: null };
  });

  it('writes tenant_id when tenantId is provided', async () => {
    const tracker = new LLMCostTracker();
    const supabase = createClient();

    await tracker.trackUsage({
      userId: 'u-tenant',
      tenantId: 'tenant-123',
      provider: 'openai',
      model: 'meta-llama/Llama-3-70b-chat-hf',
      promptTokens: 10,
      completionTokens: 5,
      caller: 'LLMCostTracker.test',
      endpoint: 'llm-gateway',
      success: true,
      latencyMs: 9,
    });

    await Promise.resolve();
    // @ts-expect-error test mock client exposes state
    expect(supabase.state.lastInsertPayload.tenant_id).toBe('tenant-123');
  });

  it('maps tenant_id input to tenant_id DB field', async () => {
    const tracker = new LLMCostTracker();
    const supabase = createClient();

    await tracker.trackUsage({
      userId: 'u-tenant-snake',
      tenant_id: 'tenant-snake-123',
      provider: 'openai',
      model: 'meta-llama/Llama-3-70b-chat-hf',
      promptTokens: 10,
      completionTokens: 5,
      caller: 'LLMCostTracker.test',
      endpoint: 'llm-gateway',
      success: true,
      latencyMs: 9,
    });

    await Promise.resolve();
    // @ts-expect-error test mock client exposes state
    expect(supabase.state.lastInsertPayload.tenant_id).toBe('tenant-snake-123');
  });

  it('gives tenantId precedence over tenant_id when both are provided', async () => {
    const tracker = new LLMCostTracker();
    const supabase = createClient();

    await tracker.trackUsage({
      userId: 'u-tenant-both',
      tenantId: 'tenant-camel-wins',
      tenant_id: 'tenant-snake-loses',
      provider: 'openai',
      model: 'meta-llama/Llama-3-70b-chat-hf',
      promptTokens: 10,
      completionTokens: 5,
      caller: 'LLMCostTracker.test',
      endpoint: 'llm-gateway',
      success: true,
      latencyMs: 9,
    });

    await Promise.resolve();
    // @ts-expect-error test mock client exposes state
    expect(supabase.state.lastInsertPayload.tenant_id).toBe('tenant-camel-wins');
  });

  it('logs an error and skips insert when usage is written without tenant', async () => {
    const tracker = new LLMCostTracker();
    const supabase = createClient();

    await tracker.trackUsage({
      userId: 'u-missing-tenant',
      provider: 'openai',
      model: 'meta-llama/Llama-3-70b-chat-hf',
      promptTokens: 10,
      completionTokens: 5,
      caller: 'LLMCostTracker.test',
      endpoint: 'llm-gateway',
      success: false,
      latencyMs: 9,
      errorMessage: 'missing tenant',
    });

    await Promise.resolve();
    expect(logger.error).toHaveBeenCalledWith(
      'LLM usage missing tenant id; skipping usage insert',
      expect.objectContaining({
        caller: 'LLMCostTracker.test',
        endpoint: 'llm-gateway',
      })
    );
    // @ts-expect-error test mock client exposes state
    expect(supabase.state.insertCount).toBe(0);
  });

  it('queries canonical cost and timestamp fields for period analytics', async () => {
    const tracker = new LLMCostTracker();
    const supabase = createClient();

    state.selectResponse = {
      data: [{ cost: 1.25 }, { cost: 0.75 }],
      error: null,
    };

    const total = await tracker.getCostForPeriod(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
      'user-123',
      'tenant-abc',
    );

    expect(total).toBe(2);
    // @ts-expect-error test mock client exposes state
    expect(supabase.state.lastSelectColumns).toBe('cost');
    // @ts-expect-error test mock client exposes state
    expect(supabase.state.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'gte', column: 'created_at' }),
        expect.objectContaining({ op: 'lte', column: 'created_at' }),
        expect.objectContaining({ op: 'eq', column: 'user_id', value: 'user-123' }),
        expect.objectContaining({ op: 'eq', column: 'tenant_id', value: 'tenant-abc' }),
      ]),
    );
  });

  it('dedupes alerts within hour and still persists', async () => {
    const tracker = new LLMCostTracker();
    const supabase = createClient();

    vi.spyOn(tracker, 'getHourlyCost').mockResolvedValue(60);
    vi.spyOn(tracker, 'getDailyCost').mockResolvedValue(0);
    vi.spyOn(tracker, 'getMonthlyCost').mockResolvedValue(0);

    state.selectResponse = { data: [], error: null };
    await tracker.checkCostThresholds('tenant-99');

    // @ts-expect-error test mock client exposes state
    expect(supabase.state.insertCount).toBe(1);
    // @ts-expect-error test mock client exposes state
    expect(supabase.state.lastInsertPayload.level).toBe('critical');
    // @ts-expect-error test mock client exposes state
    expect(supabase.state.lastInsertPayload.tenant_id).toBe('tenant-99');

    state.selectResponse = { data: [{ id: 1 }], error: null };
    await tracker.checkCostThresholds('tenant-99');

    // @ts-expect-error test mock client exposes state
    expect(supabase.state.insertCount).toBe(1);
  });
});
