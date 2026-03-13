/**
 * EvidenceTiering unit tests
 */

import { describe, expect, it } from 'vitest';

import {
  classifyEvidence,
  EvidenceTierValue,
  getTierWeight,
  getMaxAgeDays,
  type EvidenceItem,
} from '../EvidenceTiering.js';

function makeItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: 'ev-1',
    sourceType: 'internal_data',
    sourceName: 'CRM',
    content: 'Revenue data from Q1',
    retrievedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Tier 1 sources: edgar_filing, customer_provided, primary_data, etc.
// Tier 2 sources: gartner, forrester, industry_benchmark, secondary_data, etc.
// Tier 3: everything else (default)
// Max age: Tier 1=365d, Tier 2=730d, Tier 3=1095d (Tier 3 is most lenient)

describe('EvidenceTiering', () => {
  describe('classifyEvidence()', () => {
    it('classifies edgar_filing as Tier 1', () => {
      const result = classifyEvidence(makeItem({ sourceType: 'edgar_filing' }));
      expect(result.tier).toBe(EvidenceTierValue.TIER_1);
    });

    it('classifies primary_data as Tier 1', () => {
      const result = classifyEvidence(makeItem({ sourceType: 'primary_data' }));
      expect(result.tier).toBe(EvidenceTierValue.TIER_1);
    });

    it('classifies gartner as Tier 2', () => {
      const result = classifyEvidence(makeItem({ sourceType: 'gartner' }));
      expect(result.tier).toBe(EvidenceTierValue.TIER_2);
    });

    it('classifies secondary_data as Tier 2', () => {
      const result = classifyEvidence(makeItem({ sourceType: 'secondary_data' }));
      expect(result.tier).toBe(EvidenceTierValue.TIER_2);
    });

    it('classifies unknown source as Tier 3', () => {
      const result = classifyEvidence(makeItem({ sourceType: 'unknown_source_xyz' }));
      expect(result.tier).toBe(EvidenceTierValue.TIER_3);
    });

    it('returns weight and maxAgeDays on classified item', () => {
      const result = classifyEvidence(makeItem({ sourceType: 'edgar_filing' }));
      expect(result.weight).toBeGreaterThan(0);
      expect(result.maxAgeDays).toBeGreaterThan(0);
    });

    it('preserves original item fields', () => {
      const item = makeItem({ id: 'ev-99', sourceName: 'Salesforce' });
      const result = classifyEvidence(item);
      expect(result.id).toBe('ev-99');
      expect(result.sourceName).toBe('Salesforce');
    });
  });

  describe('getTierWeight()', () => {
    it('Tier 1 has higher weight than Tier 2', () => {
      expect(getTierWeight(1)).toBeGreaterThan(getTierWeight(2));
    });

    it('Tier 2 has higher weight than Tier 3', () => {
      expect(getTierWeight(2)).toBeGreaterThan(getTierWeight(3));
    });
  });

  describe('getMaxAgeDays()', () => {
    // Tier 3 has the longest max age (1095d) — it is the most lenient tier.
    // Tier 1 is the strictest (365d) because primary data must be recent.
    it('Tier 3 has longer max age than Tier 1', () => {
      expect(getMaxAgeDays(3)).toBeGreaterThan(getMaxAgeDays(1));
    });

    it('Tier 2 has longer max age than Tier 1', () => {
      expect(getMaxAgeDays(2)).toBeGreaterThan(getMaxAgeDays(1));
    });
  });
});
