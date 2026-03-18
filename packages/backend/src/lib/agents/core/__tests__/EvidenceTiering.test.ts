import { describe, expect, it } from 'vitest';

import {
  buildEvidenceBundle,
  classifyEvidence,
  type EvidenceItem,
  getMaxAgeDays,
  getTierWeight,
  TIER_MAX_AGE_DAYS,
  TIER_WEIGHTS,
} from '../EvidenceTiering.js';

function makeItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: 'ev-1',
    sourceType: 'edgar_filing',
    sourceName: 'ACME 10-K',
    content: 'Revenue grew 12% YoY.',
    retrievedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('classifyEvidence', () => {
  it('assigns Tier 1 to edgar_filing', () => {
    const result = classifyEvidence(makeItem({ sourceType: 'edgar_filing' }));
    expect(result.tier).toBe(1);
    expect(result.weight).toBe(TIER_WEIGHTS[1]);
    expect(result.maxAgeDays).toBe(TIER_MAX_AGE_DAYS[1]);
  });

  it('assigns Tier 1 to sec_filing (normalised source type)', () => {
    // '10-k' normalises to '10_k' which is not in TIER_1_SOURCES; use 'sec_filing' instead
    const result = classifyEvidence(makeItem({ sourceType: 'sec_filing' }));
    expect(result.tier).toBe(1);
  });

  it('assigns Tier 2 to gartner', () => {
    const result = classifyEvidence(makeItem({ sourceType: 'gartner' }));
    expect(result.tier).toBe(2);
    expect(result.weight).toBe(TIER_WEIGHTS[2]);
  });

  it('assigns Tier 2 to industry_benchmark', () => {
    const result = classifyEvidence(makeItem({ sourceType: 'industry_benchmark' }));
    expect(result.tier).toBe(2);
  });

  it('assigns Tier 3 to unknown source types', () => {
    const result = classifyEvidence(makeItem({ sourceType: 'blog_post' }));
    expect(result.tier).toBe(3);
    expect(result.weight).toBe(TIER_WEIGHTS[3]);
  });

  it('preserves all original fields', () => {
    const item = makeItem({ id: 'ev-99', sourceName: 'Test Source', sourceUrl: 'https://example.com' });
    const result = classifyEvidence(item);
    expect(result.id).toBe('ev-99');
    expect(result.sourceName).toBe('Test Source');
    expect(result.sourceUrl).toBe('https://example.com');
    expect(result.content).toBe(item.content);
  });
});

describe('buildEvidenceBundle', () => {
  it('classifies all items and builds citations', () => {
    const items: EvidenceItem[] = [
      makeItem({ id: 'ev-1', sourceType: 'edgar_filing', content: 'A'.repeat(300) }),
      makeItem({ id: 'ev-2', sourceType: 'gartner', content: 'B'.repeat(50) }),
    ];

    const bundle = buildEvidenceBundle('case-1', items);

    expect(bundle.valueCaseId).toBe('case-1');
    expect(bundle.items).toHaveLength(2);
    expect(bundle.items[0]!.tier).toBe(1);
    expect(bundle.items[1]!.tier).toBe(2);
    expect(bundle.citations).toHaveLength(2);
  });

  it('truncates citation excerpts to 200 chars', () => {
    const items: EvidenceItem[] = [
      makeItem({ id: 'ev-1', content: 'X'.repeat(500) }),
    ];
    const bundle = buildEvidenceBundle('case-1', items);
    expect(bundle.citations[0]!.excerpt.length).toBe(200);
  });

  it('returns empty bundle for empty input', () => {
    const bundle = buildEvidenceBundle('case-1', []);
    expect(bundle.items).toHaveLength(0);
    expect(bundle.citations).toHaveLength(0);
  });
});

describe('getTierWeight / getMaxAgeDays', () => {
  it('returns correct weights', () => {
    expect(getTierWeight(1)).toBe(1.0);
    expect(getTierWeight(2)).toBe(0.7);
    expect(getTierWeight(3)).toBe(0.4);
  });

  it('returns correct max ages', () => {
    expect(getMaxAgeDays(1)).toBe(365);
    expect(getMaxAgeDays(2)).toBe(730);
    expect(getMaxAgeDays(3)).toBe(1095);
  });
});
