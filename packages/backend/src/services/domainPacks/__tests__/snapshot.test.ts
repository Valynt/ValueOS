import { describe, expect, it } from 'vitest';
import {
  detectDrift,
  effectiveFromSnapshot,
  isDomainPackSnapshot,
  snapshotFromEffective,
  snapshotMergedPack,
  snapshotPack,
} from '../snapshot.js';
import type { DomainPackSnapshot } from '../snapshot.js';
import type {
  DomainPack,
  DomainPackAssumption,
  DomainPackKpi,
  EffectiveDomainPack,
} from '../../../api/domainPacks/types.js';

// ============================================================================
// Fixtures
// ============================================================================

function kpi(key: string, confidence = 0.8): DomainPackKpi {
  return { kpiKey: key, defaultName: key, defaultConfidence: confidence, sortOrder: 0 };
}

function assumption(key: string, value = 1): DomainPackAssumption {
  return {
    assumptionKey: key,
    valueType: 'number',
    valueNumber: value,
    defaultConfidence: 0.9,
    evidenceRefs: [],
  } as DomainPackAssumption;
}

function makePack(overrides: Partial<DomainPack> & { id: string }): DomainPack {
  return {
    tenantId: 'tenant-1',
    name: 'Test Pack',
    industry: 'SaaS',
    version: '1.0.0',
    status: 'active',
    parentPackId: null,
    kpis: [],
    assumptions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEffective(overrides?: Partial<EffectiveDomainPack>): EffectiveDomainPack {
  return {
    packId: 'pack-1',
    parentPackId: null,
    name: 'SaaS Pack',
    industry: 'SaaS',
    version: '1.0.0',
    kpis: [kpi('nrr'), kpi('cac')],
    assumptions: [assumption('discount_rate', 0.08)],
    ...overrides,
  };
}

// ============================================================================
// snapshotFromEffective
// ============================================================================

describe('snapshotFromEffective', () => {
  it('creates a snapshot with schemaVersion 1', () => {
    const effective = makeEffective();
    const snapshot = snapshotFromEffective(effective);

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.packId).toBe('pack-1');
    expect(snapshot.name).toBe('SaaS Pack');
    expect(snapshot.kpis).toHaveLength(2);
    expect(snapshot.assumptions).toHaveLength(1);
    expect(snapshot.snapshotCreatedAt).toBeTruthy();
  });

  it('deep-copies KPIs so mutations do not affect the snapshot', () => {
    const effective = makeEffective();
    const snapshot = snapshotFromEffective(effective);

    effective.kpis[0].defaultName = 'MUTATED';
    expect(snapshot.kpis[0].defaultName).toBe('nrr');
  });

  it('includes a valid ISO timestamp', () => {
    const snapshot = snapshotFromEffective(makeEffective());
    const parsed = new Date(snapshot.snapshotCreatedAt);
    expect(parsed.getTime()).not.toBeNaN();
  });
});

// ============================================================================
// snapshotPack / snapshotMergedPack
// ============================================================================

describe('snapshotPack', () => {
  it('snapshots a standalone pack', () => {
    const pack = makePack({
      id: 'pack-1',
      kpis: [kpi('nrr')],
      assumptions: [assumption('rate')],
    });
    const snapshot = snapshotPack(pack);
    expect(snapshot.packId).toBe('pack-1');
    expect(snapshot.kpis).toHaveLength(1);
  });
});

describe('snapshotMergedPack', () => {
  it('snapshots a merged parent+child', () => {
    const parent = makePack({
      id: 'parent-1',
      kpis: [kpi('nrr'), kpi('cac')],
      assumptions: [assumption('discount_rate', 0.08)],
    });
    const child = makePack({
      id: 'child-1',
      parentPackId: 'parent-1',
      kpis: [kpi('nrr'), kpi('ltv')], // overrides nrr, adds ltv
      assumptions: [assumption('discount_rate', 0.06)], // overrides
    });

    const snapshot = snapshotMergedPack(parent, child);
    expect(snapshot.packId).toBe('child-1');
    expect(snapshot.parentPackId).toBe('parent-1');
    expect(snapshot.kpis).toHaveLength(3); // nrr (child), cac (parent), ltv (child)
    expect(snapshot.assumptions).toHaveLength(1);
    expect(snapshot.assumptions[0].valueNumber).toBe(0.06);
  });
});

// ============================================================================
// effectiveFromSnapshot
// ============================================================================

describe('effectiveFromSnapshot', () => {
  it('reconstructs an EffectiveDomainPack', () => {
    const snapshot = snapshotFromEffective(makeEffective());
    const effective = effectiveFromSnapshot(snapshot);

    expect(effective.packId).toBe('pack-1');
    expect(effective.kpis).toHaveLength(2);
    expect(effective.assumptions).toHaveLength(1);
  });

  it('round-trips correctly', () => {
    const original = makeEffective({ version: '2.3.4' });
    const snapshot = snapshotFromEffective(original);
    const reconstructed = effectiveFromSnapshot(snapshot);

    expect(reconstructed.packId).toBe(original.packId);
    expect(reconstructed.version).toBe('2.3.4');
    expect(reconstructed.kpis.map((k) => k.kpiKey)).toEqual(
      original.kpis.map((k) => k.kpiKey),
    );
  });
});

// ============================================================================
// isDomainPackSnapshot
// ============================================================================

describe('isDomainPackSnapshot', () => {
  it('returns true for valid snapshots', () => {
    const snapshot = snapshotFromEffective(makeEffective());
    expect(isDomainPackSnapshot(snapshot)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isDomainPackSnapshot(null)).toBe(false);
  });

  it('returns false for wrong schemaVersion', () => {
    const bad = { ...snapshotFromEffective(makeEffective()), schemaVersion: 2 };
    expect(isDomainPackSnapshot(bad)).toBe(false);
  });

  it('returns false for missing fields', () => {
    expect(isDomainPackSnapshot({ schemaVersion: 1 })).toBe(false);
    expect(isDomainPackSnapshot({ schemaVersion: 1, packId: 'x' })).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isDomainPackSnapshot('string')).toBe(false);
    expect(isDomainPackSnapshot(42)).toBe(false);
    expect(isDomainPackSnapshot(undefined)).toBe(false);
  });
});

// ============================================================================
// detectDrift
// ============================================================================

describe('detectDrift', () => {
  it('returns empty array when snapshot matches current', () => {
    const effective = makeEffective();
    const snapshot = snapshotFromEffective(effective);
    const drifts = detectDrift(snapshot, effective);
    expect(drifts).toHaveLength(0);
  });

  it('detects version drift', () => {
    const effective = makeEffective();
    const snapshot = snapshotFromEffective(effective);
    const updated = { ...effective, version: '2.0.0' };
    const drifts = detectDrift(snapshot, updated);
    expect(drifts.some((d) => d.field === 'version')).toBe(true);
  });

  it('detects removed KPIs', () => {
    const effective = makeEffective();
    const snapshot = snapshotFromEffective(effective);
    const updated = { ...effective, kpis: [kpi('nrr')] }; // removed 'cac'
    const drifts = detectDrift(snapshot, updated);
    expect(drifts.some((d) => d.field === 'kpis' && d.snapshotValue === 'cac')).toBe(true);
  });

  it('detects added KPIs', () => {
    const effective = makeEffective();
    const snapshot = snapshotFromEffective(effective);
    const updated = { ...effective, kpis: [...effective.kpis, kpi('ltv')] };
    const drifts = detectDrift(snapshot, updated);
    expect(drifts.some((d) => d.field === 'kpis' && d.currentValue === 'ltv')).toBe(true);
  });

  it('detects confidence changes', () => {
    const effective = makeEffective({ kpis: [kpi('nrr', 0.8)] });
    const snapshot = snapshotFromEffective(effective);
    const updated = { ...effective, kpis: [kpi('nrr', 0.95)] };
    const drifts = detectDrift(snapshot, updated);
    expect(drifts.some((d) => d.field.includes('defaultConfidence'))).toBe(true);
  });

  it('detects removed assumptions', () => {
    const effective = makeEffective();
    const snapshot = snapshotFromEffective(effective);
    const updated = { ...effective, assumptions: [] };
    const drifts = detectDrift(snapshot, updated);
    expect(drifts.some((d) => d.field === 'assumptions')).toBe(true);
  });
});
