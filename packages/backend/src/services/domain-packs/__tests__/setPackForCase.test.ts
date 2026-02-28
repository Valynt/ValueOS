import { describe, expect, it, vi } from 'vitest';

import { DomainPackService } from '../DomainPackService.js';

const PACK_ID = '00000000-0000-0000-0000-000000000001';
const CASE_ID = '00000000-0000-0000-0000-000000000010';
const TENANT_ID = '00000000-0000-0000-0000-000000000099';

const mockPack = {
  id: PACK_ID,
  tenant_id: null,
  name: 'Banking',
  slug: 'banking',
  industry: 'Banking',
  description: 'Banking pack',
  version: '1.0.0',
  status: 'active',
  glossary: { revenue_uplift: 'NII Expansion' },
  narrative_templates: {},
  compliance_rules: ['SOX compliance required'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockKpis = [
  {
    id: 'kpi-1',
    pack_id: PACK_ID,
    kpi_key: 'core_modernization_savings',
    default_name: 'Core System Modernization Savings',
    description: 'Annual savings',
    unit: 'USD',
    direction: 'up',
    category: 'Cost',
    baseline_hint: '$15M–$50M/year',
    target_hint: '30–50% reduction',
    sort_order: 1,
  },
];

const mockAssumptions = [
  {
    id: 'asn-1',
    pack_id: PACK_ID,
    assumption_key: 'discount_rate',
    display_name: 'Discount Rate',
    description: 'WACC for banking',
    value_type: 'number',
    value_number: 12,
    value_bool: null,
    value_text: null,
    unit: '%',
    category: 'Financial',
    sort_order: 1,
  },
];

describe('DomainPackService.setPackForCase', () => {
  it('creates a snapshot when attaching a pack to a case', async () => {
    let capturedUpdate: Record<string, unknown> | null = null;

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'domain_packs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockPack, error: null }),
              }),
            }),
          };
        }
        if (table === 'domain_pack_kpis') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockKpis, error: null }),
              }),
            }),
          };
        }
        if (table === 'domain_pack_assumptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockAssumptions, error: null }),
              }),
            }),
          };
        }
        if (table === 'value_cases') {
          return {
            update: vi.fn((data: Record<string, unknown>) => {
              capturedUpdate = data;
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              };
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    };

    const service = new DomainPackService(mockClient as unknown as import('@supabase/supabase-js').SupabaseClient);
    await service.setPackForCase(CASE_ID, PACK_ID, TENANT_ID);

    // Verify the update was called with snapshot data
    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate!.domain_pack_id).toBe(PACK_ID);
    expect(capturedUpdate!.domain_pack_version).toBe('1.0.0');

    const snapshot = capturedUpdate!.domain_pack_snapshot as Record<string, unknown>;
    expect(snapshot).toBeDefined();
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.packId).toBe(PACK_ID);
    expect(snapshot.name).toBe('Banking');
    expect(snapshot.industry).toBe('Banking');
    expect(snapshot.version).toBe('1.0.0');
    expect(snapshot.snapshotCreatedAt).toBeDefined();

    // Verify KPIs are in the snapshot
    const snapshotKpis = snapshot.kpis as Array<Record<string, unknown>>;
    expect(snapshotKpis).toHaveLength(1);
    expect(snapshotKpis[0].kpiKey).toBe('core_modernization_savings');

    // Verify assumptions are in the snapshot
    const snapshotAssumptions = snapshot.assumptions as Array<Record<string, unknown>>;
    expect(snapshotAssumptions).toHaveLength(1);
    expect(snapshotAssumptions[0].assumptionKey).toBe('discount_rate');
    expect(snapshotAssumptions[0].valueNumber).toBe(12);

    // Verify glossary and compliance rules are in the snapshot
    expect(snapshot.glossary).toEqual({ revenue_uplift: 'NII Expansion' });
    expect(snapshot.complianceRules).toEqual(['SOX compliance required']);
  });
});
