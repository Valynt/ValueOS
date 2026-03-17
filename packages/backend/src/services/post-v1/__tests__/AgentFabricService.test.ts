// @vitest-environment node
/**
 * AgentFabricService — tenant isolation tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';


vi.mock('../../../lib/agents/orchestration/index.js', () => ({
  ValueHypothesisSchema: {
    parse: (input: unknown) => input,
  },
  LoopResultSchema: {
    safeParse: () => ({ success: true }),
  },
}));

type Row = Record<string, unknown>;
type TableData = Record<string, Row[]>;

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  single: () => Promise<{ data: Row | null; error: null }>;
  then: (
    onfulfilled?: ((value: { data: Row[]; error: null }) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

const filterRows = (rows: Row[], filters: Array<[string, unknown]>): Row[] =>
  rows.filter((row) => filters.every(([column, value]) => row[column] === value));

const createSupabaseMock = (tables: TableData) => ({
  from: vi.fn((table: string) => {
    const filters: Array<[string, unknown]> = [];

    const chain: QueryBuilder = {
      select: () => chain,
      eq: (column, value) => {
        filters.push([column, value]);
        return chain;
      },
      single: async () => {
        const rows = filterRows(tables[table] ?? [], filters);
        return { data: rows[0] ?? null, error: null };
      },
      then: (onfulfilled, onrejected) => {
        const result = Promise.resolve({ data: filterRows(tables[table] ?? [], filters), error: null });
        return result.then(onfulfilled ?? undefined, onrejected ?? undefined);
      },
    };

    return chain;
  }),
});

vi.mock('../../../lib/supabase.js', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/supabase.js')>('../../../lib/supabase.js');
  return {
    ...actual,
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from '../../../lib/supabase.js';
import { agentFabricService } from '../AgentFabricService.js';

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';
const VALUE_CASE_ID = '33333333-3333-3333-3333-333333333333';

describe('AgentFabricService.getValueCaseById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the value_case does not belong to the given organization', async () => {
    vi.mocked(supabase.from).mockImplementation(
      createSupabaseMock({
        value_cases: [],
      }).from,
    );

    const result = await agentFabricService.getValueCaseById(VALUE_CASE_ID, ORG_A);
    expect(result).toBeNull();
  });

  it('returns only same-tenant rows when two tenants share identical value_case_id references', async () => {
    vi.mocked(supabase.from).mockImplementation(
      createSupabaseMock({
        value_cases: [
          { id: VALUE_CASE_ID, organization_id: ORG_A, quality_score: 8 },
          { id: VALUE_CASE_ID, organization_id: ORG_B, quality_score: 14 },
        ],
        company_profiles: [
          { value_case_id: VALUE_CASE_ID, organization_id: ORG_A, company_name: 'Tenant A Co', industry: 'SaaS' },
          { value_case_id: VALUE_CASE_ID, organization_id: ORG_B, company_name: 'Tenant B Co', industry: 'FinServ' },
        ],
        value_maps: [
          { value_case_id: VALUE_CASE_ID, organization_id: ORG_A, feature: 'A1', capability: 'CapA', business_outcome: 'Growth', value_driver: 'revenue' },
          { value_case_id: VALUE_CASE_ID, organization_id: ORG_B, feature: 'B1', capability: 'CapB', business_outcome: 'Efficiency', value_driver: 'cost' },
        ],
        kpi_hypotheses: [
          { value_case_id: VALUE_CASE_ID, organization_id: ORG_A, kpi_name: 'NRR', target_value: 120 },
          { value_case_id: VALUE_CASE_ID, organization_id: ORG_B, kpi_name: 'CAC', target_value: 15 },
        ],
        financial_models: [
          { value_case_id: VALUE_CASE_ID, organization_id: ORG_A, roi_percentage: 21, npv_amount: 500000, payback_months: 10, cost_breakdown: {} },
          { value_case_id: VALUE_CASE_ID, organization_id: ORG_B, roi_percentage: 9, npv_amount: 90000, payback_months: 24, cost_breakdown: {} },
        ],
        assumptions: [
          { value_case_id: VALUE_CASE_ID, organization_id: ORG_A, name: 'A-assumption', value: 'yes' },
          { value_case_id: VALUE_CASE_ID, organization_id: ORG_B, name: 'B-assumption', value: 'no' },
        ],
      }).from,
    );

    const resultA = await agentFabricService.getValueCaseById(VALUE_CASE_ID, ORG_A);
    const resultB = await agentFabricService.getValueCaseById(VALUE_CASE_ID, ORG_B);

    expect(resultA?.company_profile.company_name).toBe('Tenant A Co');
    expect(resultA?.value_maps).toEqual([
      expect.objectContaining({ feature: 'A1', organization_id: ORG_A }),
    ]);
    expect(resultA?.kpi_hypotheses).toEqual([
      expect.objectContaining({ kpi_name: 'NRR', organization_id: ORG_A }),
    ]);
    expect(resultA?.assumptions).toEqual([
      expect.objectContaining({ name: 'A-assumption', organization_id: ORG_A }),
    ]);
    expect(resultA?.financial_model.roi_percentage).toBe(21);

    expect(resultB?.company_profile.company_name).toBe('Tenant B Co');
    expect(resultB?.value_maps).toEqual([
      expect.objectContaining({ feature: 'B1', organization_id: ORG_B }),
    ]);
    expect(resultB?.kpi_hypotheses).toEqual([
      expect.objectContaining({ kpi_name: 'CAC', organization_id: ORG_B }),
    ]);
    expect(resultB?.assumptions).toEqual([
      expect.objectContaining({ name: 'B-assumption', organization_id: ORG_B }),
    ]);
    expect(resultB?.financial_model.roi_percentage).toBe(9);
  });

  it('applies organization_id filter to every related table query', async () => {
    const tables: string[] = [];
    const eqCallsByTable: Record<string, Array<[string, unknown]>> = {};

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      tables.push(table);
      const calls: Array<[string, unknown]> = [];
      eqCallsByTable[table] = calls;

      const chain: QueryBuilder = {
        select: () => chain,
        eq: (column, value) => {
          calls.push([column, value]);
          return chain;
        },
        single: async () => ({ data: table === 'value_cases' ? { id: VALUE_CASE_ID, organization_id: ORG_A } : null, error: null }),
        then: (onfulfilled, onrejected) => {
          const result = Promise.resolve({ data: [], error: null });
          return result.then(onfulfilled ?? undefined, onrejected ?? undefined);
        },
      };

      return chain;
    });

    await agentFabricService.getValueCaseById(VALUE_CASE_ID, ORG_A);

    const tenantScopedTables = ['value_cases', 'company_profiles', 'value_maps', 'kpi_hypotheses', 'financial_models', 'assumptions'];
    for (const table of tenantScopedTables) {
      expect(tables).toContain(table);
      expect(eqCallsByTable[table]).toContainEqual(['organization_id', ORG_A]);
    }
  });
});
