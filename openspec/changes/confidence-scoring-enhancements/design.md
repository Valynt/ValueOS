# Design: Confidence Scoring Enhancements

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ConfidenceScorer                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐      ┌──────────────────┐              │
│  │ Base Confidence  │─────▶│ Corroboration    │              │
│  │ (from evidence)  │      │ Boost (+0.15 max)│              │
│  └──────────────────┘      └──────────────────┘              │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌──────────────────┐      ┌──────────────────┐              │
│  │ Expired Evidence │      │ Final Confidence │              │
│  │ Penalty          │─────▶│ Score            │              │
│  └──────────────────┘      └──────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Corroboration Boost

**Logic:**
- For each claim, identify unique source tiers
- Each tier beyond the first adds +0.05 boost (capped at 0.15)
- Sources must be from different tiers to count as independent

**Formula:**
```
boost = min(0.15, (unique_tiers - 1) * 0.05)
```

## Expired Evidence Penalty

**Tier Max Ages:**
- `tier_1_sec`: 1 year (10-K/10-Q annual refresh)
- `tier_2_benchmark`: 6 months (quarterly refresh)
- `tier_3_web`: 3 months (frequent refresh)
- `tier_4_llm`: 1 month (very frequent refresh)

**Penalty Calculation:**
```
months_overdue = floor((now - evidence_date - max_age) / 30 days)
penalty = min(0.3, months_overdue * 0.05)
```

## Implementation Details

### ConfidenceScorer Interface

```typescript
interface ConfidenceInput {
  sources: EvidenceSource[];
  claimType: 'financial' | 'operational' | 'strategic';
}

interface ConfidenceResult {
  score: number; // 0-1
  requiresAdditionalEvidence: boolean;
  details: {
    baseConfidence: number;
    corroborationBoost: number;
    expiredPenalty: number;
  };
}
```

### Validation Rules

1. **All financial claims must have confidence scores** - Error if missing
2. **Confidence < 0.5 requires flagging** - Set `requiresAdditionalEvidence: true`

## Error Handling

- Missing evidence date → assume expired (apply max penalty)
- Unknown tier → default to tier_3_web (3 month max age)
- Clock skew → use server time, ignore client timestamps

## Testing Strategy

- Unit tests for boost calculation (boundary at 0.15 cap)
- Unit tests for penalty calculation (various months overdue)
- Integration tests for validation rules
