import { describe, expect, it } from 'vitest';

import type { DomainPack, DomainPackAssumption, DomainPackKpi } from '../../../api/domain-packs/types.js';
import { mergeAssumptions, mergeKpis, mergePack, packToEffective } from '../merge.js';

// ============================================================================
// Fixtures
// ============================================================================

function kpi(overrides: Partial<DomainPackKpi> & { kpiKey: string }): DomainPackKpi {
  return {
    defaultName: overrides.kpiKey,
    defaultConfidence: 0.8,
    sortOrder: 0,
    ...overrides,
  };
}

function assumption(
  overrides: Partial<DomainPackAssumption> & { assumptionKey: string },
): DomainPackAssumption {
  return {
    valueType: 'number',
    valueNumber: 0,
    defaultConfidence: 0.9,
    evidenceRefs: [],
    ...overrides,
  } as DomainPackAssumption;
}

function makePack(overrides: Partial<DomainPack> & { id: string }): DomainPack {
  return {
    tenantId: 'tenant-1',
    name: 'Test Pack',
    industry: 'SaaS',
    version: '1.0.0',
    status: 'draft',
    parentPackId: null,
    kpis: [],
    assumptions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// mergeKpis
// ============================================================================

describe('mergeKpis', () => {
  it('returns child KPIs when parent is empty', () => {
    const child = [kpi({ kpiKey: 'nrr' }), kpi({ kpiKey: 'cac' })];
    const result = mergeKpis([], child);
    expect(result).toHaveLength(2);
    expect(result.map((k) => k.kpiKey)).toEqual(['nrr', 'cac']);
  });

  it('returns parent KPIs when child is empty', () => {
    const parent = [kpi({ kpiKey: 'nrr' })];
    const result = mergeKpis(parent, []);
    expect(result).toHaveLength(1);
    expect(result[0].kpiKey).toBe('nrr');
  });

  it('child overrides parent by key', () => {
    const parent = [kpi({ kpiKey: 'nrr', defaultName: 'Parent NRR', defaultConfidence: 0.7 })];
    const child = [kpi({ kpiKey: 'nrr', defaultName: 'Child NRR', defaultConfidence: 0.9 })];
    const result = mergeKpis(parent, child);
    expect(result).toHaveLength(1);
    expect(result[0].defaultName).toBe('Child NRR');
    expect(result[0].defaultConfidence).toBe(0.9);
  });

  it('preserves parent order, appends child-only keys', () => {
    const parent = [kpi({ kpiKey: 'a' }), kpi({ kpiKey: 'b' })];
    const child = [kpi({ kpiKey: 'c' }), kpi({ kpiKey: 'b', defaultName: 'B-override' })];
    const result = mergeKpis(parent, child);
    expect(result.map((k) => k.kpiKey)).toEqual(['a', 'b', 'c']);
    expect(result[1].defaultName).toBe('B-override');
  });

  it('handles both empty', () => {
    expect(mergeKpis([], [])).toEqual([]);
  });
});

// ============================================================================
// mergeAssumptions
// ============================================================================

describe('mergeAssumptions', () => {
  it('child overrides parent by key', () => {
    const parent = [assumption({ assumptionKey: 'discount_rate', valueNumber: 0.08 })];
    const child = [assumption({ assumptionKey: 'discount_rate', valueNumber: 0.10 })];
    const result = mergeAssumptions(parent, child);
    expect(result).toHaveLength(1);
    expect(result[0].valueNumber).toBe(0.10);
  });

  it('preserves parent-only assumptions', () => {
    const parent = [
      assumption({ assumptionKey: 'discount_rate', valueNumber: 0.08 }),
      assumption({ assumptionKey: 'payback_years', valueNumber: 3 }),
    ];
    const child = [assumption({ assumptionKey: 'discount_rate', valueNumber: 0.10 })];
    const result = mergeAssumptions(parent, child);
    expect(result).toHaveLength(2);
    expect(result[1].assumptionKey).toBe('payback_years');
  });

  it('appends child-only assumptions', () => {
    const parent = [assumption({ assumptionKey: 'a' })];
    const child = [assumption({ assumptionKey: 'b' })];
    const result = mergeAssumptions(parent, child);
    expect(result.map((a) => a.assumptionKey)).toEqual(['a', 'b']);
  });
});

// ============================================================================
// mergePack
// ============================================================================

describe('mergePack', () => {
  it('produces an EffectiveDomainPack with merged KPIs and assumptions', () => {
    const parent = makePack({
      id: 'parent-1',
      name: 'SaaS Base',
      kpis: [kpi({ kpiKey: 'nrr' }), kpi({ kpiKey: 'cac' })],
      assumptions: [assumption({ assumptionKey: 'discount_rate', valueNumber: 0.08 })],
    });
    const child = makePack({
      id: 'child-1',
      name: 'SaaS Enterprise',
      parentPackId: 'parent-1',
      kpis: [kpi({ kpiKey: 'nrr', defaultName: 'Enterprise NRR' }), kpi({ kpiKey: 'ltv' })],
      assumptions: [assumption({ assumptionKey: 'discount_rate', valueNumber: 0.06 })],
    });

    const result = mergePack(parent, child);

    expect(result.packId).toBe('child-1');
    expect(result.parentPackId).toBe('parent-1');
    expect(result.name).toBe('SaaS Enterprise');
    expect(result.kpis).toHaveLength(3); // nrr (overridden), cac (parent), ltv (child-only)
    expect(result.kpis[0].defaultName).toBe('Enterprise NRR');
    expect(result.assumptions).toHaveLength(1);
    expect(result.assumptions[0].valueNumber).toBe(0.06);
  });
});

// ============================================================================
// packToEffective
// ============================================================================

describe('packToEffective', () => {
  it('converts a standalone pack', () => {
    const pack = makePack({
      id: 'pack-1',
      kpis: [kpi({ kpiKey: 'nrr' })],
      assumptions: [assumption({ assumptionKey: 'rate' })],
    });
    const result = packToEffective(pack);
    expect(result.packId).toBe('pack-1');
    expect(result.kpis).toHaveLength(1);
    expect(result.assumptions).toHaveLength(1);
  });

  it('does not mutate the original pack arrays', () => {
    const pack = makePack({ id: 'pack-1', kpis: [kpi({ kpiKey: 'a' })] });
    const result = packToEffective(pack);
    result.kpis.push(kpi({ kpiKey: 'b' }));
    expect(pack.kpis).toHaveLength(1);
  });
});
