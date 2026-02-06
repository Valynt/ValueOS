import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __setEnvSourceForTests } from '../../lib/env';
import { LLMCostTracker } from '../LLMCostTracker.js'
import { createClient } from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js', () => {
  const state: any = {
    lastInsertPayload: null,
    lastInsertTable: null,
    lastSelectColumns: null,
    filters: [] as Array<{ op: string; column: string; value: any }>,
    selectResponse: { data: null, error: null },
    insertCount: 0,
  };

  const createBuilder = (table: string) => {
    return {
      select: (columns: string) => {
        state.lastSelectColumns = columns;
        return createBuilder(table);
      },
      eq: (column: string, value: any) => {
        state.filters.push({ op: 'eq', column, value });
        return createBuilder(table);
      },
      gte: (column: string, value: any) => {
        state.filters.push({ op: 'gte', column, value });
        return createBuilder(table);
      },
      lte: (column: string, value: any) => {
        state.filters.push({ op: 'lte', column, value });
        return createBuilder(table);
      },
      limit: (_n: number) => createBuilder(table),
      insert: async (payload: any) => {
        state.lastInsertTable = table;
        state.lastInsertPayload = payload;
        state.insertCount++;
        return { error: null };
      },
      then: (resolve: (value: any) => void) => resolve(state.selectResponse),
    } as any;
  };

  const client = {
    state,
    from: (table: string) => createBuilder(table),
  };

  return { createClient: () => client };
});

vi.mock('../../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe('LLMCostTracker', () => {
  beforeEach(() => {
    __setEnvSourceForTests({
      VITE_SUPABASE_URL: 'http://test',
      SUPABASE_SERVICE_ROLE_KEY: 'svc',
    });
    vi.clearAllMocks();
    // @ts-ignore
    const supabase = createClient();
    // @ts-ignore
    supabase.state.lastInsertPayload = null;
    // @ts-ignore
    supabase.state.lastInsertTable = null;
    // @ts-ignore
    supabase.state.lastSelectColumns = null;
    // @ts-ignore
    supabase.state.filters = [];
    // @ts-ignore
    supabase.state.selectResponse = { data: null, error: null };
    // @ts-ignore
    supabase.state.insertCount = 0;
  });

  it('calculates cost per pricing table and default', () => {
    const tracker = new LLMCostTracker();
    expect(tracker.calculateCost('meta-llama/Llama-3-70b-chat-hf', 1_000, 500))
      .toBeCloseTo((0.0009 + 0.00045), 6);
    expect(tracker.calculateCost('unknown-model', 1_000, 1_000))
      .toBeCloseTo(0.002, 6);
  });

  it('writes canonical llm_usage column names on trackUsage insert', async () => {
    const tracker = new LLMCostTracker();
    // @ts-ignore
    const supabase = createClient();

    await tracker.trackUsage({
      tenantId: 'tenant-1',
      userId: 'u1',
      sessionId: 's1',
      provider: 'together_ai',
      model: 'meta-llama/Llama-3-70b-chat-hf',
      promptTokens: 1000,
      completionTokens: 500,
      endpoint: 'llm-gateway',
      success: true,
      latencyMs: 42,
    });

    expect(supabase.state.lastInsertTable).toBe('llm_usage');
    expect(supabase.state.lastInsertPayload).toMatchObject({
      tenant_id: 'tenant-1',
      user_id: 'u1',
      session_id: 's1',
      input_tokens: 1000,
      output_tokens: 500,
      total_tokens: 1500,
      cost: expect.any(Number),
      created_at: expect.any(String),
    });
    expect(supabase.state.lastInsertPayload).not.toHaveProperty('prompt_tokens');
    expect(supabase.state.lastInsertPayload).not.toHaveProperty('completion_tokens');
    expect(supabase.state.lastInsertPayload).not.toHaveProperty('estimated_cost');
    expect(supabase.state.lastInsertPayload).not.toHaveProperty('timestamp');
  });

  it('queries canonical cost and timestamp fields for period analytics', async () => {
    const tracker = new LLMCostTracker();
    // @ts-ignore
    const supabase = createClient();

    // @ts-ignore
    supabase.state.selectResponse = {
      data: [{ cost: 1.25 }, { cost: 0.75 }],
      error: null,
    };

    const total = await tracker.getCostForPeriod(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
      'user-123'
    );

    expect(total).toBe(2);
    expect(supabase.state.lastSelectColumns).toBe('cost');
    expect(supabase.state.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'gte', column: 'created_at' }),
        expect.objectContaining({ op: 'lte', column: 'created_at' }),
        expect.objectContaining({ op: 'eq', column: 'user_id', value: 'user-123' }),
      ])
    );
  });

  it('dedupes alerts within hour and still persists', async () => {
    const tracker = new LLMCostTracker();
    // @ts-ignore
    const supabase = createClient();

    vi.spyOn(tracker, 'getHourlyCost').mockResolvedValue(60);
    vi.spyOn(tracker, 'getDailyCost').mockResolvedValue(0);
    vi.spyOn(tracker, 'getMonthlyCost').mockResolvedValue(0);

    // @ts-ignore
    supabase.state.selectResponse = { data: [], error: null };

    await tracker.checkCostThresholds();

    // @ts-ignore
    expect(supabase.state.insertCount).toBe(1);
    // @ts-ignore
    expect(supabase.state.lastInsertPayload.level).toBe('critical');

    // @ts-ignore
    supabase.state.selectResponse = { data: [{ id: 1 }], error: null };

    await tracker.checkCostThresholds();

    // @ts-ignore
    expect(supabase.state.insertCount).toBe(1);
  });
});
