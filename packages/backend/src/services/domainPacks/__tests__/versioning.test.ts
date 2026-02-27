import { describe, expect, it } from 'vitest';
import {
  assertMutable,
  assertPublishable,
  assertPublishableWithGovernance,
  assertVersionIncreased,
  compareSemver,
  detectCircularParent,
  formatSemver,
  nextMajor,
  nextMinor,
  nextPatch,
  nextVersion,
  parseSemver,
  validateParentNotDeprecated,
} from '../versioning.js';
import type { DomainPackAssumption, DomainPackKpi } from '../../../api/domainPacks/types.js';

// ============================================================================
// parseSemver / formatSemver
// ============================================================================

describe('parseSemver', () => {
  it('parses valid semver', () => {
    expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseSemver('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
    expect(parseSemver('10.20.30')).toEqual({ major: 10, minor: 20, patch: 30 });
  });

  it('returns null for invalid strings', () => {
    expect(parseSemver('1.2')).toBeNull();
    expect(parseSemver('v1.2.3')).toBeNull();
    expect(parseSemver('abc')).toBeNull();
    expect(parseSemver('1.2.3-beta')).toBeNull();
    expect(parseSemver('')).toBeNull();
  });
});

describe('formatSemver', () => {
  it('formats parts to string', () => {
    expect(formatSemver({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3');
  });
});

// ============================================================================
// Version bumps
// ============================================================================

describe('nextPatch', () => {
  it('bumps patch', () => {
    expect(nextPatch('1.2.3')).toBe('1.2.4');
    expect(nextPatch('0.0.0')).toBe('0.0.1');
  });

  it('throws on invalid input', () => {
    expect(() => nextPatch('bad')).toThrow('Invalid semver');
  });
});

describe('nextMinor', () => {
  it('bumps minor and resets patch', () => {
    expect(nextMinor('1.2.3')).toBe('1.3.0');
  });
});

describe('nextMajor', () => {
  it('bumps major and resets minor+patch', () => {
    expect(nextMajor('1.2.3')).toBe('2.0.0');
  });
});

describe('nextVersion', () => {
  it('defaults to patch bump', () => {
    expect(nextVersion('1.0.0')).toBe('1.0.1');
  });
});

// ============================================================================
// compareSemver
// ============================================================================

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });

  it('compares major', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
  });

  it('compares minor', () => {
    expect(compareSemver('1.3.0', '1.2.9')).toBe(1);
  });

  it('compares patch', () => {
    expect(compareSemver('1.2.4', '1.2.3')).toBe(1);
  });

  it('throws on invalid input', () => {
    expect(() => compareSemver('bad', '1.0.0')).toThrow();
  });
});

// ============================================================================
// assertPublishable
// ============================================================================

function kpi(key: string, name = key): DomainPackKpi {
  return {
    kpiKey: key,
    defaultName: name,
    defaultConfidence: 0.8,
    sortOrder: 0,
  };
}

function assumption(key: string): DomainPackAssumption {
  return {
    assumptionKey: key,
    valueType: 'number',
    valueNumber: 1,
    defaultConfidence: 0.9,
    evidenceRefs: [],
  } as DomainPackAssumption;
}

describe('assertPublishable', () => {
  it('returns no errors for a valid pack', () => {
    const errors = assertPublishable({
      name: 'SaaS Pack',
      industry: 'SaaS',
      version: '1.0.0',
      kpis: [kpi('nrr'), kpi('cac')],
      assumptions: [assumption('discount_rate')],
    });
    expect(errors).toHaveLength(0);
  });

  it('requires at least one KPI', () => {
    const errors = assertPublishable({
      name: 'Empty Pack',
      industry: 'SaaS',
      version: '1.0.0',
      kpis: [],
      assumptions: [],
    });
    expect(errors.some((e) => e.field === 'kpis')).toBe(true);
  });

  it('detects duplicate KPI keys', () => {
    const errors = assertPublishable({
      name: 'Dup Pack',
      industry: 'SaaS',
      version: '1.0.0',
      kpis: [kpi('nrr'), kpi('nrr')],
      assumptions: [],
    });
    expect(errors.some((e) => e.message.includes('Duplicate KPI key'))).toBe(true);
  });

  it('detects duplicate assumption keys', () => {
    const errors = assertPublishable({
      name: 'Dup Pack',
      industry: 'SaaS',
      version: '1.0.0',
      kpis: [kpi('nrr')],
      assumptions: [assumption('rate'), assumption('rate')],
    });
    expect(errors.some((e) => e.message.includes('Duplicate assumption key'))).toBe(true);
  });

  it('rejects empty name', () => {
    const errors = assertPublishable({
      name: '  ',
      industry: 'SaaS',
      version: '1.0.0',
      kpis: [kpi('nrr')],
      assumptions: [],
    });
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('rejects invalid semver', () => {
    const errors = assertPublishable({
      name: 'Pack',
      industry: 'SaaS',
      version: 'bad',
      kpis: [kpi('nrr')],
      assumptions: [],
    });
    expect(errors.some((e) => e.field === 'version')).toBe(true);
  });

  it('rejects KPI with empty defaultName', () => {
    const errors = assertPublishable({
      name: 'Pack',
      industry: 'SaaS',
      version: '1.0.0',
      kpis: [kpi('nrr', '  ')],
      assumptions: [],
    });
    expect(errors.some((e) => e.field.includes('defaultName'))).toBe(true);
  });
});

// ============================================================================
// Governance Checks
// ============================================================================

describe('detectCircularParent', () => {
  const packs = new Map([
    ['a', { id: 'a', parentPackId: 'b' }],
    ['b', { id: 'b', parentPackId: 'c' }],
    ['c', { id: 'c', parentPackId: null }],
  ]);
  const resolve = (id: string) => packs.get(id);

  it('returns null for a valid chain', () => {
    expect(detectCircularParent('a', 'b', resolve)).toBeNull();
  });

  it('detects a direct self-reference', () => {
    expect(detectCircularParent('x', 'x', resolve)).toBe('x');
  });

  it('detects a cycle in the chain', () => {
    const cyclicPacks = new Map([
      ['a', { id: 'a', parentPackId: 'b' }],
      ['b', { id: 'b', parentPackId: 'a' }], // cycle: a -> b -> a
    ]);
    expect(detectCircularParent('a', 'b', (id) => cyclicPacks.get(id))).toBe('a');
  });

  it('returns null when parent does not exist', () => {
    expect(detectCircularParent('a', 'nonexistent', resolve)).toBeNull();
  });

  it('returns null when no parent', () => {
    expect(detectCircularParent('a', null, resolve)).toBeNull();
  });
});

describe('validateParentNotDeprecated', () => {
  it('returns null for active parent', () => {
    expect(validateParentNotDeprecated('active')).toBeNull();
  });

  it('returns null for draft parent', () => {
    expect(validateParentNotDeprecated('draft')).toBeNull();
  });

  it('returns error for deprecated parent', () => {
    const err = validateParentNotDeprecated('deprecated');
    expect(err).not.toBeNull();
    expect(err!.field).toBe('parentPackId');
  });

  it('returns null for undefined', () => {
    expect(validateParentNotDeprecated(undefined)).toBeNull();
  });
});

describe('assertMutable', () => {
  it('returns null for draft packs', () => {
    expect(assertMutable('draft')).toBeNull();
  });

  it('returns error for active packs', () => {
    const err = assertMutable('active');
    expect(err).not.toBeNull();
    expect(err!.message).toContain('immutable');
  });

  it('returns error for deprecated packs', () => {
    const err = assertMutable('deprecated');
    expect(err).not.toBeNull();
    expect(err!.message).toContain('Deprecated');
  });
});

describe('assertVersionIncreased', () => {
  it('returns null when no current published version', () => {
    expect(assertVersionIncreased('1.0.0', null)).toBeNull();
  });

  it('returns null when version is greater', () => {
    expect(assertVersionIncreased('2.0.0', '1.0.0')).toBeNull();
    expect(assertVersionIncreased('1.1.0', '1.0.0')).toBeNull();
    expect(assertVersionIncreased('1.0.1', '1.0.0')).toBeNull();
  });

  it('returns error when version is equal', () => {
    const err = assertVersionIncreased('1.0.0', '1.0.0');
    expect(err).not.toBeNull();
    expect(err!.message).toContain('must be greater');
  });

  it('returns error when version is lower', () => {
    const err = assertVersionIncreased('1.0.0', '2.0.0');
    expect(err).not.toBeNull();
  });
});

describe('assertPublishableWithGovernance', () => {
  const validPack = {
    id: 'pack-1',
    name: 'SaaS Pack',
    industry: 'SaaS',
    version: '1.0.0',
    status: 'draft' as const,
    parentPackId: null,
    kpis: [kpi('nrr')],
    assumptions: [],
  };

  it('passes for a valid draft pack with no context', () => {
    expect(assertPublishableWithGovernance(validPack)).toHaveLength(0);
  });

  it('rejects non-draft packs', () => {
    const errors = assertPublishableWithGovernance({ ...validPack, status: 'active' });
    expect(errors.some((e) => e.message.includes('Only draft'))).toBe(true);
  });

  it('rejects deprecated parent', () => {
    const errors = assertPublishableWithGovernance(
      { ...validPack, parentPackId: 'parent-1' },
      { parentStatus: 'deprecated' },
    );
    expect(errors.some((e) => e.field === 'parentPackId')).toBe(true);
  });

  it('rejects version not increased', () => {
    const errors = assertPublishableWithGovernance(validPack, {
      currentPublishedVersion: '1.0.0',
    });
    expect(errors.some((e) => e.field === 'version')).toBe(true);
  });

  it('detects circular parent', () => {
    const packs = new Map([
      ['parent-1', { id: 'parent-1', parentPackId: 'pack-1' }], // cycle
    ]);
    const errors = assertPublishableWithGovernance(
      { ...validPack, parentPackId: 'parent-1' },
      { resolveParent: (id) => packs.get(id) },
    );
    expect(errors.some((e) => e.message.includes('Circular'))).toBe(true);
  });

  it('passes all governance checks when valid', () => {
    const packs = new Map([
      ['parent-1', { id: 'parent-1', parentPackId: null }],
    ]);
    const errors = assertPublishableWithGovernance(
      { ...validPack, version: '2.0.0', parentPackId: 'parent-1' },
      {
        parentStatus: 'active',
        currentPublishedVersion: '1.0.0',
        resolveParent: (id) => packs.get(id),
      },
    );
    expect(errors).toHaveLength(0);
  });
});
