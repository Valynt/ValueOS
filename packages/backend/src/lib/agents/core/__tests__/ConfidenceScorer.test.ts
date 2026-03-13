/**
 * ConfidenceScorer unit tests
 */

import { describe, expect, it } from 'vitest';

import {
  computeConfidence,
  computeFreshness,
  computeReliability,
  computeTransparency,
  scoreClaimConfidence,
  type ConfidenceInput,
} from '../ConfidenceScorer.js';
import { classifyEvidence } from '../EvidenceTiering.js';

function makeInput(overrides: Partial<ConfidenceInput> = {}): ConfidenceInput {
  return {
    evidence: classifyEvidence({
      id: 'ev-1',
      sourceType: 'edgar_filing', // Tier 1 source
      sourceName: 'SEC EDGAR',
      content: 'Annual 10-K filing',
      retrievedAt: new Date().toISOString(),
    }),
    transparency: 'full',
    ...overrides,
  };
}

describe('ConfidenceScorer', () => {
  describe('computeFreshness()', () => {
    it('returns 1.0 for a timestamp from today', () => {
      const score = computeFreshness(new Date().toISOString(), 1);
      expect(score).toBeCloseTo(1.0, 1);
    });

    it('returns lower score for older timestamps (Tier 1, 365d max)', () => {
      // Tier 1 max age = 365d. A 400-day-old item is past max → score = 0.
      // A fresh item → score ≈ 1.0.
      const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
      const fresh = new Date().toISOString();
      expect(computeFreshness(old, 1)).toBeLessThan(computeFreshness(fresh, 1));
    });

    it('returns 0 for items past max age', () => {
      const veryOld = new Date(Date.now() - 2000 * 24 * 60 * 60 * 1000).toISOString();
      expect(computeFreshness(veryOld, 1)).toBe(0);
    });
  });

  describe('computeReliability()', () => {
    it('Tier 1 has higher reliability than Tier 3', () => {
      expect(computeReliability(1)).toBeGreaterThan(computeReliability(3));
    });

    it('returns value in [0, 1]', () => {
      for (const tier of [1, 2, 3] as const) {
        const r = computeReliability(tier);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('computeTransparency()', () => {
    it('full > partial > opaque', () => {
      expect(computeTransparency('full')).toBeGreaterThan(computeTransparency('partial'));
      expect(computeTransparency('partial')).toBeGreaterThan(computeTransparency('opaque'));
    });
  });

  describe('computeConfidence()', () => {
    it('returns overall score in [0, 1]', () => {
      const score = computeConfidence(makeInput());
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(1);
    });

    it('Tier 1 full-transparency scores higher than Tier 3 opaque', () => {
      const high = computeConfidence(makeInput({ transparency: 'full' }));
      const low = computeConfidence({
        evidence: classifyEvidence({
          id: 'ev-2',
          sourceType: 'unknown',
          sourceName: 'Unknown',
          content: 'Unverified claim',
          retrievedAt: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString(),
        }),
        transparency: 'opaque',
      });
      expect(high.overall).toBeGreaterThan(low.overall);
    });
  });

  describe('scoreClaimConfidence()', () => {
    it('returns claimId and score', () => {
      const classified = classifyEvidence({
        id: 'ev-1',
        sourceType: 'edgar_filing',
        sourceName: 'SEC EDGAR',
        content: 'Annual 10-K filing',
        retrievedAt: new Date().toISOString(),
      });
      const result = scoreClaimConfidence('claim-1', [classified], 'full', []);
      expect(result.claimId).toBe('claim-1');
      expect(result.score.overall).toBeGreaterThanOrEqual(0);
      expect(result.score.overall).toBeLessThanOrEqual(1);
    });
  });
});
