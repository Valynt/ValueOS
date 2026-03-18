# Design: Unsupported Assumption Detection

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           UnsupportedAssumptionDetector                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐      ┌──────────────────┐              │
│  │ Scan Assumptions │─────▶│ Check Evidence   │              │
│  │ (by case_id)     │      │ (attached?)      │              │
│  └──────────────────┘      └──────────────────┘              │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌──────────────────┐      ┌──────────────────┐              │
│  │ Check Benchmark  │      │ Flag Unsupported │              │
│  │ (reference?)     │─────▶│ (persist flag)   │              │
│  └──────────────────┘      └──────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Detection Logic

An assumption is **unsupported** if:
```
(evidence_count = 0) AND (benchmark_reference IS NULL)
```

## Assumption Register Schema

Add `support_status` field to assumptions table:

```typescript
interface Assumption {
  id: string;
  caseId: string;
  content: string;
  // ... existing fields
  supportStatus: 'supported' | 'unsupported' | 'partial';
  evidenceCount: number;
  benchmarkReference?: string;
  flaggedAt?: Date;
}
```

## Service Interface

```typescript
interface DetectionInput {
  caseId: string;
  tenantId: string;
}

interface DetectionResult {
  totalAssumptions: number;
  unsupportedCount: number;
  unsupportedAssumptions: Assumption[];
}

class UnsupportedAssumptionDetector {
  async detect(input: DetectionInput): Promise<DetectionResult>;
  async flagAssumption(assumptionId: string): Promise<void>;
  async clearFlag(assumptionId: string): Promise<void>;
}
```

## Readiness Score Integration

Unsupported assumptions affect readiness score:

```typescript
function calculateReadinessScore(metrics: ReadinessMetrics): number {
  const unsupportedPenalty = metrics.unsupportedAssumptionCount * 0.1;
  return baseScore - unsupportedPenalty;
}
```

## UI Integration

Flags surfaced in readiness panel:
- Badge: "3 unsupported assumptions"
- Warning icon on assumption register
- Tooltip: "This assumption lacks evidence or benchmark reference"

## Batch Processing

```typescript
// Run on case save, case open, and nightly
async function scanCase(caseId: string): Promise<void> {
  const result = await detector.detect({ caseId, tenantId });
  
  for (const assumption of result.unsupportedAssumptions) {
    await detector.flagAssumption(assumption.id);
  }
}
```

## Testing

Test cases:
- Assumption with evidence → not flagged
- Assumption with benchmark → not flagged  
- Assumption with neither → flagged
- Mixed case → only unsupported flagged
