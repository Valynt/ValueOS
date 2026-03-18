# Design: Hallucination Defense

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Narrative Generation Pipeline              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────┐ │
│  │ Narrative   │───▶│ Hallucination    │───▶│ Persist    │ │
│  │ Agent       │    │ Checker          │    │ (if clean) │ │
│  │ (generates) │    │ (validates)      │    │            │ │
│  └─────────────┘    └──────────────────┘    └────────────┘ │
│                            │                                │
│                            ▼ (if critical)                  │
│                     ┌──────────────────┐                    │
│                     │ BLOCK & FLAG     │                    │
│                     │ (don't persist)  │                    │
│                     └──────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## HallucinationChecker Service

```typescript
interface HallucinationCheck {
  narrativeId: string;
  text: string;
  expectedFigures: CalculatedFigure[];
}

interface HallucinationResult {
  passed: boolean;
  hallucinations: Hallucination[];
  severity: 'none' | 'minor' | 'major' | 'critical';
}

interface Hallucination {
  type: 'mismatch' | 'fabricated' | 'missing';
  figure: string; // e.g., "$1.2M"
  location: { start: number; end: number };
  expected?: number;
  found?: number;
  severity: 'minor' | 'major' | 'critical';
  explanation: string;
}

class NarrativeHallucinationChecker {
  async check(input: HallucinationCheck): Promise<HallucinationResult>;
}
```

## Figure Parsing

Parse financial figures from narrative text:

```typescript
function parseFinancialFigures(text: string): ParsedFigure[] {
  const patterns = [
    // Currency: $1.2M, $500K, $10 million
    /\$([0-9]+\.?[0-9]*)\s?(M|K|million|billion)?/gi,
    // Percentages: 15%, 15 percent
    /([0-9]+\.?[0-9]*)\s?(percent|%)/gi,
    // Time periods: 3 years, 12 months
    /([0-9]+)\s?(years?|months?|quarters?)/gi,
  ];
  
  const figures: ParsedFigure[] = [];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      figures.push({
        raw: match[0],
        value: normalizeValue(match[1], match[2]),
        location: { start: match.index, end: match.index + match[0].length },
        type: classifyType(match[0])
      });
    }
  }
  
  return figures;
}
```

## Cross-Reference Logic

Compare parsed figures against deterministic calculations:

```typescript
async function crossReferenceFigures(
  parsed: ParsedFigure[],
  expected: CalculatedFigure[]
): Promise<Hallucination[]> {
  const hallucinations: Hallucination[] = [];
  
  for (const figure of parsed) {
    const match = expected.find(e => 
      e.metric === figure.type && 
      Math.abs(e.value - figure.value) < e.value * 0.01 // 1% tolerance
    );
    
    if (!match) {
      // Check if it's close to any expected figure (mismatch)
      const nearMatch = expected.find(e => 
        e.metric === figure.type && 
        Math.abs(e.value - figure.value) < e.value * 0.10 // 10% tolerance
      );
      
      if (nearMatch) {
        hallucinations.push({
          type: 'mismatch',
          figure: figure.raw,
          location: figure.location,
          expected: nearMatch.value,
          found: figure.value,
          severity: 'major',
          explanation: `Expected ${nearMatch.value}, found ${figure.value}`
        });
      } else {
        // No match at all - fabricated
        hallucinations.push({
          type: 'fabricated',
          figure: figure.raw,
          location: figure.location,
          severity: 'critical',
          explanation: 'No matching calculation found'
        });
      }
    }
  }
  
  // Check for missing expected figures
  for (const expected of expectedFigures) {
    const found = parsed.find(p => 
      p.type === expected.metric && 
      Math.abs(p.value - expected.value) < expected.value * 0.01
    );
    
    if (!found && expected.required) {
      hallucinations.push({
        type: 'missing',
        figure: expected.metric,
        severity: 'minor',
        explanation: `Expected figure ${expected.metric} not found in narrative`
      });
    }
  }
  
  return hallucinations;
}
```

## Severity Classification

| Type | Severity | Action |
|------|----------|--------|
| Mismatch < 10% | minor | Log, continue |
| Mismatch 10-50% | major | Flag, notify |
| Mismatch > 50% | critical | Block persistence |
| Fabricated | critical | Block persistence |
| Missing (required) | minor | Log, continue |

## Pipeline Integration

```typescript
class NarrativePipeline {
  async generateAndValidate(context: PipelineContext): Promise<NarrativeResult> {
    // 1. Generate narrative
    const narrative = await narrativeAgent.generate(context);
    
    // 2. Get expected figures from economic kernel
    const expectedFigures = await economicKernel.getCalculatedFigures(
      context.caseId
    );
    
    // 3. Check for hallucinations
    const check = await hallucinationChecker.check({
      narrativeId: narrative.id,
      text: narrative.text,
      expectedFigures
    });
    
    // 4. Handle results
    if (check.severity === 'critical') {
      await this.flagForReview(narrative, check);
      throw new HallucinationError(
        'Critical hallucinations detected. Narrative blocked.'
      );
    }
    
    // 5. Persist if clean
    await narrativeRepository.save(narrative);
    
    return { narrative, validation: check };
  }
}
```

## Error Handling

```typescript
class HallucinationError extends Error {
  constructor(
    message: string,
    public hallucinations: Hallucination[]
  ) {
    super(message);
    this.name = 'HallucinationError';
  }
}
```

## Testing Strategy

- Unit tests for figure parsing (various formats)
- Unit tests for cross-reference (matching, mismatching)
- Unit tests for severity classification
- Integration tests for pipeline blocking
