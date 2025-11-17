import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ValueFabricService } from '../../services/ValueFabricService';
import { createBoltClientMock } from '../utils/mockSupabaseClient';

const baseTables = {
  capabilities: [
    { id: 'cap-1', name: 'Automation', is_active: true, tags: ['automation', 'workflow'], category: 'platform' },
    { id: 'cap-2', name: 'Analytics', is_active: true, tags: ['analytics'], category: 'insights' },
  ],
  benchmarks: [
    { id: 'bench-1', kpi_name: 'NPS', industry: 'SaaS', percentile: 25, value: 20, data_date: '2024-01-01' },
    { id: 'bench-2', kpi_name: 'NPS', industry: 'SaaS', percentile: 50, value: 35, data_date: '2024-01-01' },
    { id: 'bench-3', kpi_name: 'NPS', industry: 'SaaS', percentile: 75, value: 55, data_date: '2024-01-01' },
    { id: 'bench-4', kpi_name: 'NPS', industry: 'SaaS', percentile: 90, value: 70, data_date: '2024-01-01' },
  ],
};

let supabase: any;
let service: ValueFabricService;

beforeEach(() => {
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

  it('calculates benchmark percentiles and comparison values', async () => {
    const percentiles = await service.getBenchmarkPercentiles('NPS', 'SaaS');
    expect(percentiles).toEqual({ p25: 20, p50: 35, p75: 55, p90: 70 });
  });
});
