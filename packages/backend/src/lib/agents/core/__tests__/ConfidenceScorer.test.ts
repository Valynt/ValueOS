import { describe, it, expect } from 'vitest';
import {
  computeFreshness,
  computeReliability,
  computeTransparency,
  computeConfidence,
  computeAggregateConfidence,
  scoreClaimConfidence,
  type ConfidenceInput,
} from '../ConfidenceScorer.js';
import { classifyEvidence, type EvidenceItem } from '../EvidenceTiering.js';

function makeClassified(overrides: Partial<EvidenceItem> = {}) {
  return classifyEvidence({
    id: 'ev-1',
    sourceType: 'edgar_filing',
    sourceName: 'ACME 10-K',
    content: 'Revenue grew 12%.',
    retrievedAt: new Date().toISOString(),
    ...overrides,
  });
}

describe('computeFreshness', () => {
  it('returns 1.0 for evidence retrieved right now', () => {
    const now = new Date().toISOString();
    expect(computeFreshness(now, 1)).toBeCloseTo(1.0, 2);
  });

  it('returns 0.0 for evidence older than max age', () => {
    const ancient = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    // Tier 1 max age = 365 days; 400 days old → score < 0
    expect(computeFreshness(ancient, 1)).toBe(0);
  });

  it('returns partial score for evidence half as old as max age', () => {
    const halfAge = new Date(Date.now() - 182 * 24 * 60 * 60 * 1000).toISOString();
    const score = computeFreshness(halfAge, 1);
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(0.6);
  });

  it('uses referenceDate when provided', () => {
    const retrieved = '2024-01-01T00:00:00.000Z';
    const reference = '2024-01-01T00:00:00.000Z'; // same day
    expect(computeFreshness(retrieved, 1, reference)).toBeCloseTo(1.0, 2);
  });
});

describe('computeReliability', () => {
  it('returns 1.0 for Tier 1', () => expect(computeReliability(1)).toBe(1.0));
  it('returns 0.7 for Tier 2', () => expect(computeReliability(2)).toBe(0.7));
  it('returns 0.4 for Tier 3', () => expect(computeReliability(3)).toBe(0.4));
});

describe('computeTransparency', () => {
  it('returns 1.0 for full', () => expect(computeTransparency('full')).toBe(1.0));
  it('returns 0.5 for partial', () => expect(computeTransparency('partial')).toBe(0.5));
  it('returns 0.0 for opaque', () => expect(computeTransparency('opaque')).toBe(0.0));
});

describe('computeConfidence', () => {
  it('returns overall score in [0, 1]', () => {
    const input: ConfidenceInput = {
      evidence: makeClassified(),
      transparency: 'full',
    };
    const score = computeConfidence(input);
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(1);
  });

  it('returns higher score for Tier 1 + full transparency than Tier 3 + opaque', () => {
    const high: ConfidenceInput = { evidence: makeClassified({ sourceType: 'edgar_filing' }), transparency: 'full' };
    const low: ConfidenceInput = { evidence: makeClassified({ sourceType: 'blog_post' }), transparency: 'opaque' };
    expect(computeConfidence(high).overall).toBeGreaterThan(computeConfidence(low).overall);
  });

  it('includes evidenceId in result', () => {
    const input: ConfidenceInput = { evidence: makeClassified({ id: 'ev-42' }), transparency: 'partial' };
    expect(computeConfidence(input).evidenceId).toBe('ev-42');
  });
});

describe('computeAggregateConfidence', () => {
  it('returns null for empty input', () => {
    expect(computeAggregateConfidence([])).toBeNull();
  });

  it('returns single score unchanged (no boost)', () => {
    const input: ConfidenceInput = { evidence: makeClassified(), transparency: 'full' };
    const single = computeConfidence(input);
    const agg = computeAggregateConfidence([input]);
    expect(agg!.overall).toBe(single.overall);
  });

  it('applies corroboration boost for multiple sources', () => {
    const inputs: ConfidenceInput[] = [
      { evidence: makeClassified({ id: 'ev-1' }), transparency: 'full' },
      { evidence: makeClassified({ id: 'ev-2', sourceType: 'gartner' }), transparency: 'full' },
    ];
    const single = computeConfidence(inputs[0]!);
    const agg = computeAggregateConfidence(inputs);
    expect(agg!.overall).toBeGreaterThanOrEqual(single.overall);
  });

  it('caps overall at 1.0', () => {
    // 10 corroborating sources — boost should not exceed 1.0
    const inputs: ConfidenceInput[] = Array.from({ length: 10 }, (_, i) => ({
      evidence: makeClassified({ id: `ev-${i}` }),
      transparency: 'full' as const,
    }));
    const agg = computeAggregateConfidence(inputs);
    expect(agg!.overall).toBeLessThanOrEqual(1.0);
  });
});

describe('scoreClaimConfidence', () => {
  it('returns ClaimConfidence with correct claimId', () => {
    const ev = makeClassified();
    const result = scoreClaimConfidence('claim-1', [ev], 'full', []);
    expect(result.claimId).toBe('claim-1');
    expect(result.score.overall).toBeGreaterThan(0);
  });

  it('returns zero score for empty evidence', () => {
    const result = scoreClaimConfidence('claim-1', [], 'full', []);
    expect(result.score.overall).toBe(0);
    expect(result.score.tier).toBe(3);
  });
});
