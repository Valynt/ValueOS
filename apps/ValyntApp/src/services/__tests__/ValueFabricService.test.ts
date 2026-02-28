import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValueFabricService } from '../../services/ValueFabricService';
import { createBoltClientMock } from '../../../../../tests/test/mocks/mockSupabaseClient';

const ORG_ID = 'org-123';
const OTHER_ORG_ID = 'org-999';

const baseTables = {
  capabilities: [
    { id: 'cap-1', name: 'Automation', is_active: true, tags: ['automation', 'workflow'], category: 'platform', tenant_id: ORG_ID, organization_id: ORG_ID },
    { id: 'cap-2', name: 'Analytics', is_active: true, tags: ['analytics'], category: 'insights', tenant_id: ORG_ID, organization_id: ORG_ID },
    { id: 'cap-3', name: 'Workflow Automation Suite', is_active: true, tags: ['automation', 'orchestration'], category: 'platform', tenant_id: ORG_ID, organization_id: ORG_ID },
    { id: 'cap-4', name: 'Automation Insights', is_active: true, tags: ['automation', 'analytics'], category: 'insights', tenant_id: ORG_ID, organization_id: ORG_ID },
  ],
  use_cases: [
    { id: 'uc-1', industry: 'SaaS', tenant_id: ORG_ID, organization_id: ORG_ID },
    { id: 'uc-2', industry: 'Fintech', tenant_id: ORG_ID, organization_id: ORG_ID },
    { id: 'uc-3', industry: 'Retail', tenant_id: OTHER_ORG_ID, organization_id: OTHER_ORG_ID },
  ],
  benchmarks: [
    { id: 'bench-1', kpi_name: 'NPS', industry: 'SaaS', percentile: 25, value: 20, data_date: '2024-01-01', organization_id: ORG_ID },
    { id: 'bench-2', kpi_name: 'NPS', industry: 'SaaS', percentile: 50, value: 35, data_date: '2024-01-01', organization_id: ORG_ID },
    { id: 'bench-3', kpi_name: 'NPS', industry: 'SaaS', percentile: 75, value: 55, data_date: '2024-01-01', organization_id: ORG_ID },
    { id: 'bench-4', kpi_name: 'NPS', industry: 'SaaS', percentile: 90, value: 70, data_date: '2024-01-01', organization_id: ORG_ID },
    { id: 'bench-5', kpi_name: 'NPS', industry: 'SaaS', percentile: 90, value: 99, data_date: '2024-01-01', organization_id: OTHER_ORG_ID },
  ],
};

let supabase: unknown;
let service: ValueFabricService;

beforeEach(() => {
  globalThis.localStorage.setItem('organization_id', ORG_ID);
  supabase = createBoltClientMock(baseTables);
  (global.fetch as any) = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
  });
  service = new ValueFabricService(supabase);
});

describe('ValueFabricService semantic search and ontology queries', () => {
  it('returns semantic search results when RPC succeeds', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { item: baseTables.capabilities[0], similarity: 0.9 },
        { item: baseTables.capabilities[1], similarity: 0.8 },
      ],
      error: null,
    });

    const results = await service.semanticSearchCapabilities('automate workflows', 2);
    expect(results).toHaveLength(2);
    expect(results[0].item.name).toBe('Automation');
  });

  it('falls back to text search when RPC fails', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error('pgvector unavailable') });

    const results = await service.semanticSearchCapabilities('analytics', 1);
    expect(results[0].item.name).toBe('Analytics');
    expect(supabase.from).toHaveBeenCalled();
  });

  it('fills gaps with text search when semantic results are empty', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });

    const results = await service.semanticSearchCapabilities('analytics', 1);
    expect(results).toHaveLength(1);
    expect(results[0].item.name).toBe('Analytics');
  });

  it('combines semantic and text matches to satisfy limit', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ item: baseTables.capabilities[0], similarity: 0.92 }],
      error: null,
    });

    const results = await service.semanticSearchCapabilities('automation', 3);

    expect(results.map(r => r.item.name)).toEqual([
      'Automation',
      'Automation Insights',
      'Workflow Automation Suite',
    ]);
  });

  it('calculates benchmark percentiles and comparison values', async () => {
    const percentiles = await service.getBenchmarkPercentiles('NPS', 'SaaS');
    expect(percentiles).toEqual({ p25: 20, p50: 35, p75: 55, p90: 70 });
  });

  it('applies organization scoping to benchmark queries', async () => {
    const benchmarks = await service.getBenchmarks({ kpi_name: 'NPS', industry: 'SaaS' });
    expect(benchmarks).toHaveLength(4);
    expect(benchmarks.every((b) => b.organization_id === ORG_ID)).toBe(true);
  });

  it('applies organization scoping to ontology stats queries', async () => {
    const stats = await service.getOntologyStats();
    expect(stats.total_capabilities).toBe(4);
    expect(stats.total_use_cases).toBe(2);
    expect(stats.industries_covered.sort()).toEqual(['Fintech', 'SaaS']);
  });

  it('fails safely when organization context is missing', async () => {
    globalThis.localStorage.removeItem('organization_id');
    await expect(service.getBenchmarks({})).rejects.toThrow('Missing organization context');
  });
});
