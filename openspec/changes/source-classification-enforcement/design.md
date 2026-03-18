# Design: Source Classification Enforcement

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Source Classification System                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐      ┌──────────────────┐              │
│  │ Assumption       │      │ Evidence         │              │
│  │ Validation       │      │ Validation       │              │
│  │ (source tag      │      │ (tier, date,     │              │
│  │  required)       │      │  reliability)    │              │
│  └──────────────────┘      └──────────────────┘              │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌──────────────────────────────────────────┐                │
│  │         Zod Schema Validation            │                │
│  └──────────────────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Source Tiers

| Tier | Description | Max Age | Examples |
|------|-------------|---------|----------|
| tier_1_sec | SEC filings | 1 year | 10-K, 10-Q |
| tier_2_benchmark | Industry benchmarks | 6 months | SaaS metrics reports |
| tier_3_web | Web sources | 3 months | Company websites, news |
| tier_4_llm | LLM-generated | 1 month | Generated analysis |

## Zod Schemas

### Assumption Schema

```typescript
const AssumptionSchema = z.object({
  id: z.string().uuid(),
  sourceTag: z.enum([
    'tier_1_sec',
    'tier_2_benchmark', 
    'tier_3_web',
    'tier_4_llm'
  ]), // Required - rejection if missing
  // ... other fields
});
```

### Evidence Schema

```typescript
const EvidenceSchema = z.object({
  id: z.string().uuid(),
  sourceTier: z.enum(['tier_1_sec', 'tier_2_benchmark', 'tier_3_web', 'tier_4_llm']),
  freshnessDate: z.date().max(new Date()), // Must be present, not in future
  reliabilityScore: z.number().min(0).max(1),
  transparencyLevel: z.enum(['transparent', 'opaque', 'black_box']),
  validationStatus: z.enum(['validated', 'pending', 'rejected']),
  // ... other fields
});
```

## Validation Middleware

### Assumption Creation

```typescript
function validateAssumption(data: unknown): Assumption {
  const result = AssumptionSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      'Assumption must have a source tag',
      result.error.issues
    );
  }
  return result.data;
}
```

### Evidence Creation

```typescript
function validateEvidence(data: unknown): Evidence {
  const result = EvidenceSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      'Evidence missing required source classification fields',
      result.error.issues
    );
  }
  return result.data;
}
```

## Error Messages

- Missing source tag: `"Assumption must have a source tag (tier_1_sec, tier_2_benchmark, tier_3_web, or tier_4_llm)"`
- Missing evidence tier: `"Evidence must specify source tier"`
- Missing freshness date: `"Evidence must have freshness date"`
- Invalid reliability score: `"Reliability score must be between 0 and 1"`

## Integration Points

- API layer: Validate on POST/PUT endpoints
- Service layer: Validate before persistence
- Background jobs: Validate on batch imports
