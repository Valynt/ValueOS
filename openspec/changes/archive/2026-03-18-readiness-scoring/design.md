# Design: Readiness Scoring

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ReadinessScorer                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Inputs:                                                    │
│  ├─ Assumption validation rate                              │
│  ├─ Mean evidence grounding score                           │
│  ├─ Benchmark coverage percentage                         │
│  └─ Unsupported assumption count                            │
│                                                             │
│  Weights:                                                   │
│  ├─ Validation rate: 30%                                    │
│  ├─ Grounding score: 30%                                    │
│  ├─ Benchmark coverage: 20%                                 │
│  └─ Supported assumptions: 20%                              │
│                                                             │
│  Score: 0-1                                                 │
│  ├─ ≥ 0.8: presentation-ready ✓                            │
│  └─ < 0.6: blockers identified ⚠                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Scoring Formula

```typescript
function calculateReadinessScore(metrics: ReadinessMetrics): number {
  const validationComponent = metrics.validationRate * 0.30;
  const groundingComponent = metrics.meanGroundingScore * 0.30;
  const coverageComponent = metrics.benchmarkCoverage * 0.20;
  const supportComponent = (1 - metrics.unsupportedRatio) * 0.20;
  
  return validationComponent + groundingComponent + coverageComponent + supportComponent;
}
```

## Blocker Identification

When score < 0.6, identify specific blockers:

```typescript
interface Blocker {
  type: 'validation' | 'grounding' | 'benchmark' | 'support';
  severity: 'critical' | 'warning';
  description: string;
  count?: number;
}

function identifyBlockers(metrics: ReadinessMetrics): Blocker[] {
  const blockers: Blocker[] = [];
  
  if (metrics.validationRate < 0.6) {
    blockers.push({
      type: 'validation',
      severity: 'critical',
      description: `${(metrics.invalidAssumptions || 0)} assumptions need validation`,
      count: metrics.invalidAssumptions
    });
  }
  
  if (metrics.meanGroundingScore < 0.4) {
    blockers.push({
      type: 'grounding',
      severity: 'critical', 
      description: 'Evidence grounding scores too low',
    });
  }
  
  if (metrics.benchmarkCoverage < 0.5) {
    blockers.push({
      type: 'benchmark',
      severity: 'warning',
      description: 'Benchmark coverage below 50%',
    });
  }
  
  if (metrics.unsupportedRatio > 0.3) {
    blockers.push({
      type: 'support',
      severity: 'critical',
      description: `${(metrics.unsupportedAssumptions || 0)} assumptions lack evidence`,
      count: metrics.unsupportedAssumptions
    });
  }
  
  return blockers;
}
```

## API Response

```typescript
interface ReadinessResponse {
  caseId: string;
  score: number;
  status: 'ready' | 'needs_work' | 'incomplete';
  thresholds: {
    presentationReady: 0.8;
    needsWork: 0.6;
  };
  components: {
    validationRate: number;
    meanGroundingScore: number;
    benchmarkCoverage: number;
    supportedAssumptionRatio: number;
  };
  blockers?: Blocker[];
  evaluatedAt: string;
}
```

## Integration Points

### API Endpoint

```typescript
// GET /api/cases/:caseId/readiness
async function getReadiness(req: Request, res: Response) {
  const { caseId } = req.params;
  const tenantId = req.tenantId;
  
  const result = await readinessScorer.evaluate({ caseId, tenantId });
  res.json(result);
}
```

### IntegrityAgent Integration

```typescript
class IntegrityAgent {
  async run(context: AgentContext): Promise<AgentOutput> {
    // ... existing logic
    
    const readiness = await readinessScorer.evaluate({
      caseId: context.caseId,
      tenantId: context.tenantId
    });
    
    return {
      // ... existing output
      readiness,
      status: readiness.score >= 0.8 ? 'ready' : 'needs_work'
    };
  }
}
```

## Testing Strategy

- Unit tests for score calculation
- Boundary tests: exactly 0.8, exactly 0.6
- Blocker identification tests
- Integration tests for API endpoint
