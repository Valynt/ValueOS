# LLM Security Framework

## Overview

The LLM Security Framework provides structured outputs, hallucination detection, confidence scoring, and prediction tracking for all agent invocations in ValueCanvas.

## Key Features

### 1. **Structured Outputs**
All LLM responses follow a strict schema with:
- Type-safe result objects
- Confidence levels and scores
- Hallucination detection flags
- Assumptions and data gaps
- Evidence and reasoning traces

### 2. **Hallucination Detection**
Agents self-report when:
- Responses lack supporting data
- Claims are unsupported by evidence
- Assumptions are weak or numerous
- Data quality is insufficient

### 3. **Confidence Scoring**
Multi-dimensional confidence calculation based on:
- Data quality (30% weight)
- Assumption confidence (30% weight)
- Evidence strength (40% weight)
- Hallucination risk (penalty factor)

### 4. **Prediction Tracking**
All predictions are stored for:
- Accuracy analysis over time
- Agent performance monitoring
- Retraining trigger detection
- Variance calculation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Invocation                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              BaseAgent.secureInvoke()                        │
│  • Sanitizes input                                           │
│  • Adds security system prompt                               │
│  • Enforces structured output schema                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    LLM Gateway                               │
│  • Invokes LLM with structured output                        │
│  • Returns JSON matching schema                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Output Validation                               │
│  • Validates against schema                                  │
│  • Calculates confidence score                               │
│  • Checks thresholds                                         │
│  • Generates warnings/errors                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Prediction Storage                              │
│  • Stores in agent_predictions table                         │
│  • Tracks for accuracy analysis                              │
│  • Enables retraining triggers                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Confidence Monitoring                           │
│  • Tracks confidence trends                                  │
│  • Detects degradation                                       │
│  • Triggers alerts                                           │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Basic Usage

```typescript
import { BaseAgent } from './BaseAgent';
import { z } from 'zod';

// 1. Define your result schema
const MyResultSchema = z.object({
  prediction: z.number(),
  category: z.string(),
  confidence: z.number()
});

// 2. Use secureInvoke in your agent
class MyAgent extends BaseAgent {
  async execute(sessionId: string, input: any) {
    const result = await this.secureInvoke(
      sessionId,
      input,
      MyResultSchema,
      {
        confidenceThresholds: {
          acceptable: 0.7,
          minimum: 0.5,
          review_required: 0.6
        },
        trackPrediction: true
      }
    );

    // Handle the result
    if (result.confidence_level === 'low') {
      // Handle low confidence
    }

    if (result.hallucination_check) {
      // Handle potential hallucination
    }

    return result.result;
  }
}
```

### Advanced Usage

```typescript
// Custom confidence thresholds
const result = await this.secureInvoke(
  sessionId,
  input,
  MyResultSchema,
  {
    confidenceThresholds: {
      acceptable: 0.8,    // Higher bar for acceptance
      minimum: 0.6,       // Minimum to use result
      review_required: 0.7 // Trigger human review
    },
    throwOnLowConfidence: true, // Throw error if below minimum
    trackPrediction: true,      // Store for accuracy tracking
    context: {
      requiresHighConfidence: true,
      criticalDecision: true
    }
  }
);
```

## Schema Definition

### Secure Agent Output Schema

```typescript
{
  // Your custom result
  result: any,
  
  // Confidence indicators
  confidence_level: 'low' | 'medium' | 'high',
  confidence_score: number, // 0-1
  
  // Hallucination detection
  hallucination_check: boolean,
  hallucination_reasons: string[],
  
  // Supporting information
  assumptions: Array<{
    assumption: string,
    source: string,
    confidence: number,
    impact?: 'low' | 'medium' | 'high'
  }>,
  
  data_gaps: Array<{
    field: string,
    severity: 'low' | 'medium' | 'high',
    impact: string,
    suggestion?: string
  }>,
  
  evidence: Array<{
    type: 'data_point' | 'calculation' | 'reference' | 'heuristic',
    description: string,
    source: string,
    reliability: number
  }>,
  
  // Reasoning
  reasoning: string,
  alternative_interpretations: string[],
  
  // Metadata
  processing_time_ms: number,
  data_quality_score: number
}
```

## Confidence Thresholds

### Default Thresholds

```typescript
{
  acceptable: 0.7,      // Result is acceptable without warnings
  minimum: 0.5,         // Minimum to use result (below = reject)
  review_required: 0.6  // Trigger human review
}
```

### Threshold Behavior

| Confidence | Acceptable | Usable | Requires Review | Action |
|-----------|-----------|--------|-----------------|--------|
| ≥ 0.7 | ✅ | ✅ | ❌ | Use result |
| 0.6 - 0.69 | ❌ | ✅ | ✅ | Use with review |
| 0.5 - 0.59 | ❌ | ✅ | ✅ | Use with caution |
| < 0.5 | ❌ | ❌ | ✅ | Reject or retry |

## Confidence Calculation

```typescript
confidenceScore = (
  dataQuality * 0.3 +
  assumptionConfidence * 0.3 +
  evidenceStrength * 0.4
) * (1 - hallucinationRisk * 0.5)
```

### Components

1. **Data Quality** (30%): Quality of input data
2. **Assumption Confidence** (30%): Average confidence of assumptions
3. **Evidence Strength** (40%): Reliability of supporting evidence
4. **Hallucination Risk**: Penalty factor (0-50% reduction)

## Monitoring

### Confidence Monitoring Service

```typescript
import { ConfidenceMonitor } from '../services/ConfidenceMonitor';

const monitor = new ConfidenceMonitor(supabase);

// Register alert callback
monitor.onAlert((alert) => {
  console.error('Confidence alert:', alert);
  // Send to Sentry, PagerDuty, etc.
});

// Check confidence levels
const alerts = await monitor.checkConfidenceLevels('opportunity');

// Get metrics
const metrics = await monitor.getMetrics('opportunity', 'day');
console.log('Avg confidence:', metrics.avgConfidenceScore);
console.log('Hallucination rate:', metrics.hallucinationRate);

// Get trend
const trend = await monitor.getConfidenceTrend('opportunity', 7);
```

### Alert Types

1. **Low Confidence Spike**: >30% of predictions are low confidence
2. **High Hallucination Rate**: >20% of predictions flagged
3. **Confidence Degradation**: Average confidence below threshold

## Database Schema

### agent_predictions

Stores all predictions with confidence scores:

```sql
CREATE TABLE agent_predictions (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  
  -- Input
  input_hash TEXT NOT NULL,
  input_data JSONB NOT NULL,
  
  -- Prediction
  prediction JSONB NOT NULL,
  confidence_level TEXT NOT NULL,
  confidence_score DECIMAL(3,2),
  
  -- Quality
  hallucination_detected BOOLEAN,
  assumptions JSONB,
  data_gaps JSONB,
  evidence JSONB,
  reasoning TEXT,
  
  -- Actual outcome (for accuracy tracking)
  actual_outcome JSONB,
  variance_percentage DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### confidence_violations

Tracks threshold violations:

```sql
CREATE TABLE confidence_violations (
  id UUID PRIMARY KEY,
  agent_type TEXT NOT NULL,
  prediction_id UUID REFERENCES agent_predictions(id),
  violation_type TEXT NOT NULL,
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Best Practices

### 1. Define Strict Schemas

```typescript
// ✅ Good: Specific, typed schema
const ResultSchema = z.object({
  roi: z.number().min(0),
  payback_months: z.number().int().positive(),
  risk_level: z.enum(['low', 'medium', 'high'])
});

// ❌ Bad: Generic schema
const ResultSchema = z.any();
```

### 2. Handle Low Confidence

```typescript
const result = await this.secureInvoke(...);

if (result.confidence_level === 'low') {
  // Log for review
  await this.logForHumanReview(sessionId, result);
  
  // Use fallback or request more data
  return await this.getFallbackResult(input);
}
```

### 3. Monitor Hallucinations

```typescript
if (result.hallucination_check) {
  logger.warn('Hallucination detected', {
    agent: this.agentId,
    reasons: result.hallucination_reasons,
    assumptions: result.assumptions
  });
  
  // Consider rejecting or using rule-based fallback
}
```

### 4. Track Data Gaps

```typescript
if (result.data_gaps.length > 0) {
  const criticalGaps = result.data_gaps.filter(g => g.severity === 'high');
  
  if (criticalGaps.length > 0) {
    // Request additional data
    await this.requestDataFill(criticalGaps);
  }
}
```

### 5. Set Appropriate Thresholds

```typescript
// For critical decisions
const criticalThresholds = {
  acceptable: 0.8,
  minimum: 0.7,
  review_required: 0.75
};

// For exploratory analysis
const exploratoryThresholds = {
  acceptable: 0.6,
  minimum: 0.4,
  review_required: 0.5
};
```

## Testing

### Unit Tests

```typescript
import { validateAgentOutput } from '../schemas/SecureAgentOutput';

it('validates high confidence output', () => {
  const output = {
    result: { value: 100 },
    confidence_level: 'high',
    confidence_score: 0.85,
    hallucination_check: false,
    assumptions: [],
    data_gaps: []
  };

  const validation = validateAgentOutput(output);
  expect(validation.valid).toBe(true);
});
```

### Integration Tests

```typescript
it('securely invokes agent with tracking', async () => {
  const agent = new MyAgent(...);
  
  const result = await agent.execute('session-123', {
    input: 'test'
  });

  // Check prediction was stored
  const { data } = await supabase
    .from('agent_predictions')
    .select('*')
    .eq('session_id', 'session-123')
    .single();

  expect(data).toBeDefined();
  expect(data.confidence_level).toBeDefined();
});
```

## Migration Guide

### Updating Existing Agents

1. **Add required properties to BaseAgent**:
```typescript
export class MyAgent extends BaseAgent {
  public lifecycleStage = 'opportunity';
  public version = '2.0.0';
  public name = 'MyAgent';
  // ...
}
```

2. **Define result schema**:
```typescript
const MyResultSchema = z.object({
  // Your result structure
});
```

3. **Replace LLM calls with secureInvoke**:
```typescript
// Before
const response = await this.llmGateway.complete(messages);
const result = JSON.parse(response.content);

// After
const result = await this.secureInvoke(
  sessionId,
  input,
  MyResultSchema,
  { trackPrediction: true }
);
```

4. **Handle validation results**:
```typescript
if (result.confidence_level === 'low') {
  // Handle low confidence
}

if (result.hallucination_check) {
  // Handle hallucination
}
```

## Troubleshooting

### Low Confidence Rates

**Problem**: Agent consistently produces low confidence predictions

**Solutions**:
1. Improve input data quality
2. Add more context to prompts
3. Reduce assumption requirements
4. Adjust confidence thresholds
5. Consider retraining or fine-tuning

### High Hallucination Rates

**Problem**: Agent frequently flags hallucinations

**Solutions**:
1. Provide more grounding data
2. Strengthen system prompts
3. Add explicit evidence requirements
4. Use retrieval-augmented generation (RAG)
5. Implement fact-checking layer

### Schema Validation Failures

**Problem**: LLM output doesn't match schema

**Solutions**:
1. Simplify schema structure
2. Add schema to system prompt
3. Use few-shot examples
4. Increase temperature for creativity
5. Add retry logic with schema hints

## References

- [Zod Documentation](https://zod.dev/)
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Hallucination Detection Research](https://arxiv.org/abs/2305.14251)
- [Confidence Calibration](https://arxiv.org/abs/1706.04599)

---

**Last Updated**: 2024-11-27  
**Version**: 1.0.0  
**Status**: Production Ready
