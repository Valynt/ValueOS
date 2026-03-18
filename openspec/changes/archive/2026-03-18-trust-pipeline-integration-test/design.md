# Design: Trust Pipeline Integration Test

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Trust Pipeline Integration Test                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Test Flow:                                                 │
│                                                             │
│  ┌──────────────┐                                           │
│  │ Evidence     │  Source tagging, tier assignment         │
│  │ Ingestion    │                                           │
│  └──────┬───────┘                                           │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │ Confidence   │  Corroboration boost, freshness penalty    │
│  │ Scoring      │                                           │
│  └──────┬───────┘                                           │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │ Plausibility │  Benchmark comparison, classification      │
│  │ Testing      │                                           │
│  └──────┬───────┘                                           │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │ Readiness    │  Composite score, blocker detection      │
│  │ Scoring      │                                           │
│  └──────────────┘                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Test Structure

```typescript
describe('Trust Pipeline Integration', () => {
  // Setup test data
  const testCase = {
    id: 'test-case-1',
    tenantId: 'tenant-1',
    assumptions: [
      { id: 'a1', content: 'Revenue growth 15%', evidenceIds: ['e1', 'e2'] },
      { id: 'a2', content: 'Cost reduction 10%', evidenceIds: [] } // unsupported
    ],
    evidence: [
      { 
        id: 'e1', 
        tier: 'tier_1_sec', 
        freshnessDate: '2024-01-15',
        reliabilityScore: 0.9 
      },
      { 
        id: 'e2', 
        tier: 'tier_2_benchmark', 
        freshnessDate: '2024-02-01',
        reliabilityScore: 0.8 
      }
    ]
  };

  it('should process full pipeline: evidence → confidence → plausibility → readiness', async () => {
    // 1. Ingest evidence with source classification
    await evidenceService.ingest(testCase.evidence);
    
    // 2. Calculate confidence scores
    const confidence = await confidenceScorer.calculate({
      assumptions: testCase.assumptions,
      evidence: testCase.evidence
    });
    
    // Validate corroboration boost (2 sources = +0.05)
    expect(confidence.scores[0].details.corroborationBoost).toBe(0.05);
    
    // 3. Test plausibility classification
    const plausibility = await plausibilityClassifier.classify({
      metric: 'revenue_growth',
      targetValue: 0.15,
      benchmark: { p25: 0.10, p50: 0.15, p75: 0.20, p90: 0.30 }
    });
    
    expect(plausibility.classification).toBe('plausible'); // within p25-p75
    
    // 4. Calculate readiness score
    const readiness = await readinessScorer.evaluate({
      caseId: testCase.id,
      tenantId: testCase.tenantId
    });
    
    // Validate composite score components
    expect(readiness.components.validationRate).toBeGreaterThan(0);
    expect(readiness.components.supportedAssumptionRatio).toBeLessThan(1); // a2 unsupported
    
    // Validate score < 0.8 due to unsupported assumption
    expect(readiness.score).toBeLessThan(0.8);
  });
});
```

## Test Scenarios

### Scenario 1: Ideal Case
- All assumptions validated
- Strong evidence grounding
- Full benchmark coverage
- 100% supported assumptions
- **Expected:** Score ≥ 0.8, status = 'ready'

### Scenario 2: Mixed Quality
- Some assumptions validated
- Moderate grounding scores
- Partial benchmark coverage
- Some unsupported assumptions
- **Expected:** Score 0.6-0.8, status = 'needs_work'

### Scenario 3: Poor Quality
- Low validation rate
- Weak grounding scores
- Minimal benchmark coverage
- Many unsupported assumptions
- **Expected:** Score < 0.6, blockers identified

## Mock External Dependencies

```typescript
// Mock benchmark service
vi.mock('../../services/ground-truth/BenchmarkRetrievalService', () => ({
  retrieveBenchmark: vi.fn().mockResolvedValue({
    metricId: 'ARR_growth',
    distribution: { p25: 0.10, p50: 0.20, p75: 0.30, p90: 0.50 },
    sampleSize: 500
  })
}));

// Mock evidence storage
vi.mock('../../services/EvidenceStorage', () => ({
  getEvidence: vi.fn().mockImplementation((id) => 
    testCase.evidence.find(e => e.id === id)
  )
}));
```

## Validation Points

1. **Source Classification:** Verify correct tier assignment
2. **Confidence Calculation:** Verify corroboration boost and penalty logic
3. **Plausibility:** Verify correct classification based on percentile
4. **Readiness:** Verify composite score formula and blocker detection

## Test Data

### Evidence Items
```typescript
const evidenceItems = [
  {
    id: 'sec-001',
    tier: 'tier_1_sec',
    freshnessDate: new Date('2024-01-15'),
    reliabilityScore: 0.95,
    source: 'SEC EDGAR 10-K'
  },
  {
    id: 'bench-001',
    tier: 'tier_2_benchmark',
    freshnessDate: new Date('2024-02-01'),
    reliabilityScore: 0.85,
    source: 'Industry Report Q4 2023'
  }
];
```

### Assumptions
```typescript
const assumptions = [
  {
    id: 'asm-001',
    content: 'Revenue will grow 20% annually',
    evidenceIds: ['sec-001', 'bench-001'], // supported
    benchmarkRef: 'saas_revenue_growth'
  },
  {
    id: 'asm-002',
    content: 'Market share will double',
    evidenceIds: [], // unsupported
    benchmarkRef: null
  }
];
```

## Success Criteria

- [ ] All 3 scenarios pass
- [ ] Confidence corroboration boost calculated correctly
- [ ] Plausibility classifications correct
- [ ] Readiness score formula accurate
- [ ] Blockers correctly identified
