import { describe, expect, it, vi } from 'vitest';

import type { DomainPackSnapshot } from '../../../services/domainPacks/snapshot.js';
import {
  formatDomainContextForPrompt,
  loadDomainContext,
  loadFromSnapshot,
} from '../loadDomainContext.js';

// ============================================================================
// Test data
// ============================================================================

const TENANT_ID = '00000000-0000-0000-0000-000000000099';
const CASE_ID = '00000000-0000-0000-0000-000000000010';
const PACK_ID = '00000000-0000-0000-0000-000000000001';

const mockSnapshot: DomainPackSnapshot = {
  schemaVersion: 1,
  packId: PACK_ID,
  parentPackId: null,
  name: 'Banking & Financial Services',
  industry: 'Banking',
  version: '1.0.0',
  kpis: [
    {
      kpiKey: 'core_modernization_savings',
      defaultName: 'Core System Modernization Savings',
      description: 'Annual savings from replacing legacy systems',
      unit: 'USD',
      direction: 'increase',
      defaultConfidence: 0.8,
      sortOrder: 1,
    },
  ],
  assumptions: [
    {
      assumptionKey: 'discount_rate',
      valueType: 'number',
      valueNumber: 12,
      unit: '%',
      defaultConfidence: 0.9,
      evidenceRefs: [],
    },
  ],
  snapshotCreatedAt: '2026-01-01T00:00:00Z',
};

// ============================================================================
// Tests
// ============================================================================

describe('loadDomainContext', () => {
  it('returns empty context when no supabase client is provided', async () => {
    const ctx = await loadDomainContext(TENANT_ID, CASE_ID);

    expect(ctx.pack).toBeUndefined();
    expect(ctx.kpis).toHaveLength(0);
    expect(ctx.assumptions).toHaveLength(0);
    expect(ctx.glossary).toEqual({});
    expect(ctx.complianceRules).toEqual([]);
  });

  it('returns empty context when value case is not found', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
            }),
          }),
        }),
      }),
    };

    const ctx = await loadDomainContext(TENANT_ID, CASE_ID, mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    expect(ctx.pack).toBeUndefined();
    expect(ctx.kpis).toHaveLength(0);
  });

  it('returns empty context when no pack is attached', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: CASE_ID, domain_pack_id: null, domain_pack_snapshot: null },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const ctx = await loadDomainContext(TENANT_ID, CASE_ID, mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    expect(ctx.pack).toBeUndefined();
    expect(ctx.kpis).toHaveLength(0);
  });

  it('reconstructs context from snapshot when available', async () => {
    const snapshotWithGlossary = {
      ...mockSnapshot,
      glossary: { revenue_uplift: 'NII Expansion' },
      complianceRules: ['SOX compliance required'],
    };

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: CASE_ID,
                  domain_pack_id: PACK_ID,
                  domain_pack_snapshot: snapshotWithGlossary,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const ctx = await loadDomainContext(TENANT_ID, CASE_ID, mockSupabase as unknown as import('@supabase/supabase-js').SupabaseClient);

    expect(ctx.pack).toBeDefined();
    expect(ctx.pack?.name).toBe('Banking & Financial Services');
    expect(ctx.kpis).toHaveLength(1);
    expect(ctx.kpis[0].kpiKey).toBe('core_modernization_savings');
    expect(ctx.assumptions).toHaveLength(1);
    expect(ctx.glossary).toEqual({ revenue_uplift: 'NII Expansion' });
    expect(ctx.complianceRules).toEqual(['SOX compliance required']);
  });
});

describe('loadFromSnapshot', () => {
  it('reconstructs effective pack from snapshot', () => {
    const ctx = loadFromSnapshot(mockSnapshot);

    expect(ctx.pack).toBeDefined();
    expect(ctx.pack?.packId).toBe(PACK_ID);
    expect(ctx.pack?.name).toBe('Banking & Financial Services');
    expect(ctx.pack?.industry).toBe('Banking');
    expect(ctx.kpis).toHaveLength(1);
    expect(ctx.assumptions).toHaveLength(1);
  });

  it('extracts glossary and compliance rules from snapshot', () => {
    const snapshotWithExtras = {
      ...mockSnapshot,
      glossary: { user: 'Account Holder' },
      complianceRules: ['PCI-DSS compliance'],
    } as unknown as DomainPackSnapshot;

    const ctx = loadFromSnapshot(snapshotWithExtras);

    expect(ctx.glossary).toEqual({ user: 'Account Holder' });
    expect(ctx.complianceRules).toEqual(['PCI-DSS compliance']);
  });
});

describe('formatDomainContextForPrompt', () => {
  it('returns empty string when no pack is loaded', () => {
    const result = formatDomainContextForPrompt({
      pack: undefined,
      kpis: [],
      assumptions: [],
      glossary: {},
      complianceRules: [],
    });

    expect(result).toBe('');
  });

  it('formats KPIs and assumptions into prompt fragment', () => {
    const ctx = loadFromSnapshot(mockSnapshot);
    const result = formatDomainContextForPrompt(ctx);

    expect(result).toContain('Domain Pack: Banking & Financial Services');
    expect(result).toContain('core_modernization_savings');
    expect(result).toContain('Core System Modernization Savings');
    expect(result).toContain('discount_rate');
  });

  it('includes glossary in prompt when present', () => {
    const ctx = loadFromSnapshot(mockSnapshot);
    ctx.glossary = { revenue_uplift: 'NII Expansion', cost_reduction: 'OpEx Savings' };

    const result = formatDomainContextForPrompt(ctx);

    expect(result).toContain('Terminology');
    expect(result).toContain('"revenue_uplift" → "NII Expansion"');
    expect(result).toContain('"cost_reduction" → "OpEx Savings"');
  });

  it('includes compliance rules in prompt when present', () => {
    const ctx = loadFromSnapshot(mockSnapshot);
    ctx.complianceRules = ['SOX compliance required', 'Basel III standards apply'];

    const result = formatDomainContextForPrompt(ctx);

    expect(result).toContain('Compliance requirements');
    expect(result).toContain('SOX compliance required');
    expect(result).toContain('Basel III standards apply');
  });
});
