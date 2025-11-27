# Agent Tracing Guide

## Overview

This guide shows how to add OpenTelemetry tracing to ValueCanvas agents for observability.

## Quick Start

### 1. Import Tracing Utilities

```typescript
import {
  traceAgentExecution,
  traceAgentInvocation,
  addAgentEvent,
  recordAgentConfidence,
  recordAgentReasoning
} from '../../lib/observability';
```

### 2. Wrap Agent Execution

```typescript
export class MyAgent extends BaseAgent {
  public lifecycleStage = 'my_stage';
  public version = '1.0.0';
  public name = 'MyAgent';

  async execute(sessionId: string, input: any): Promise<any> {
    return await traceAgentExecution(
      'execute',
      {
        agentId: this.agentId,
        agentName: this.name,
        lifecycleStage: this.lifecycleStage,
        version: this.version,
        sessionId
      },
      async (span) => {
        // Your agent logic here
        const result = await this.processInput(input);
        
        // Add custom events
        addAgentEvent('processing_complete', {
          'input.size': JSON.stringify(input).length,
          'output.size': JSON.stringify(result).length
        });
        
        return result;
      }
    );
  }
}
```

### 3. Trace Secure Invocations

When using `secureInvoke`, wrap it with tracing:

```typescript
protected async analyzeValue(sessionId: string, input: any) {
  return await traceAgentInvocation(
    {
      agentId: this.agentId,
      agentName: this.name,
      lifecycleStage: this.lifecycleStage,
      version: this.version,
      sessionId
    },
    async (span) => {
      const result = await this.secureInvoke(
        sessionId,
        input,
        ValueAnalysisSchema,
        { trackPrediction: true }
      );
      
      // Record confidence metrics
      recordAgentConfidence(
        result.confidence_level,
        result.confidence_score,
        result.hallucination_check
      );
      
      // Record reasoning
      recordAgentReasoning(
        result.reasoning,
        result.assumptions,
        result.data_gaps
      );
      
      return result;
    }
  );
}
```

### 4. Trace Value Predictions

For value prediction operations:

```typescript
protected async predictROI(sessionId: string, data: any) {
  return await traceValuePrediction(
    {
      agentId: this.agentId,
      agentName: this.name,
      lifecycleStage: this.lifecycleStage,
      version: this.version,
      sessionId
    },
    'roi',
    async (span) => {
      const prediction = await this.calculateROI(data);
      
      span.setAttributes({
        'prediction.value': prediction.value,
        'prediction.confidence': prediction.confidence
      });
      
      return prediction;
    }
  );
}
```

## Tracing Patterns

### Pattern 1: Execute Method

Always wrap the main `execute` method:

```typescript
async execute(sessionId: string, input: any): Promise<any> {
  return await traceAgentExecution(
    'execute',
    this.getSpanAttributes(sessionId),
    async (span) => {
      // Implementation
    }
  );
}

private getSpanAttributes(sessionId: string) {
  return {
    agentId: this.agentId,
    agentName: this.name,
    lifecycleStage: this.lifecycleStage,
    version: this.version,
    sessionId
  };
}
```

### Pattern 2: Sub-Operations

Trace important sub-operations:

```typescript
private async buildValueTree(sessionId: string, data: any) {
  return await traceAgentExecution(
    'buildValueTree',
    this.getSpanAttributes(sessionId),
    async (span) => {
      addAgentEvent('tree_building_started');
      
      const tree = await this.constructTree(data);
      
      span.setAttributes({
        'tree.node_count': tree.nodes.length,
        'tree.depth': this.calculateDepth(tree)
      });
      
      addAgentEvent('tree_building_complete');
      
      return tree;
    }
  );
}
```

### Pattern 3: Error Handling

Errors are automatically recorded, but you can add context:

```typescript
try {
  const result = await traceAgentExecution(
    'risky_operation',
    this.getSpanAttributes(sessionId),
    async (span) => {
      addAgentEvent('operation_started', { 'risk.level': 'high' });
      return await this.performRiskyOperation();
    }
  );
} catch (error) {
  // Error is already recorded in span
  // Add additional context if needed
  logger.error('Operation failed with additional context', error, {
    context: 'specific details'
  });
  throw error;
}
```

## Custom Metrics

### Recording Custom Attributes

```typescript
import { addSpanAttributes } from '../../lib/observability';

// Inside a traced operation
addSpanAttributes({
  'custom.metric': value,
  'custom.flag': true,
  'custom.count': 42
});
```

### Recording Events

```typescript
import { addAgentEvent } from '../../lib/observability';

addAgentEvent('milestone_reached', {
  'milestone.name': 'data_validated',
  'milestone.timestamp': Date.now()
});
```

## Confidence Tracking

Always record confidence metrics for predictions:

```typescript
const result = await this.secureInvoke(sessionId, input, schema);

recordAgentConfidence(
  result.confidence_level,    // 'low' | 'medium' | 'high'
  result.confidence_score,    // 0.0 - 1.0
  result.hallucination_check  // boolean
);
```

## Reasoning Tracking

Record reasoning for audit trails:

```typescript
recordAgentReasoning(
  result.reasoning,      // Main reasoning text
  result.assumptions,    // Array of assumptions
  result.data_gaps       // Array of data gaps
);
```

## Best Practices

### 1. Trace All Public Methods

Every public method that performs significant work should be traced:

```typescript
public async analyze(sessionId: string, input: any) {
  return await traceAgentExecution('analyze', ...);
}

public async validate(sessionId: string, data: any) {
  return await traceAgentExecution('validate', ...);
}
```

### 2. Add Meaningful Attributes

Include attributes that help with debugging and analysis:

```typescript
span.setAttributes({
  'input.type': typeof input,
  'input.size_bytes': JSON.stringify(input).length,
  'output.item_count': result.items.length,
  'processing.cache_hit': cacheHit,
  'processing.llm_calls': llmCallCount
});
```

### 3. Record Key Events

Mark important milestones in processing:

```typescript
addAgentEvent('validation_started');
// ... validation logic ...
addAgentEvent('validation_complete', { 'validation.errors': errorCount });

addAgentEvent('llm_call_started');
// ... LLM call ...
addAgentEvent('llm_call_complete', { 'llm.tokens': tokenCount });
```

### 4. Keep Span Names Consistent

Use a consistent naming convention:

- `agent.{stage}.execute` - Main execution
- `agent.{stage}.invoke` - Secure invocation
- `agent.{stage}.predict.{type}` - Value predictions
- `agent.{stage}.{operation}` - Sub-operations

### 5. Don't Over-Trace

Avoid tracing:
- Simple getters/setters
- Pure utility functions
- Very frequent operations (unless performance-critical)
- Operations that complete in \u003c1ms

## Example: Complete Agent with Tracing

```typescript
import { BaseAgent } from './BaseAgent';
import {
  traceAgentExecution,
  traceAgentInvocation,
  traceValuePrediction,
  addAgentEvent,
  recordAgentConfidence,
  recordAgentReasoning
} from '../../lib/observability';
import { z } from 'zod';

const OutputSchema = z.object({
  value: z.number(),
  confidence: z.number()
});

export class ExampleAgent extends BaseAgent {
  public lifecycleStage = 'example';
  public version = '1.0.0';
  public name = 'ExampleAgent';

  async execute(sessionId: string, input: any): Promise<any> {
    return await traceAgentExecution(
      'execute',
      {
        agentId: this.agentId,
        agentName: this.name,
        lifecycleStage: this.lifecycleStage,
        version: this.version,
        sessionId
      },
      async (span) => {
        addAgentEvent('execution_started', {
          'input.keys': Object.keys(input).length
        });

        // Step 1: Validate input
        const validated = await this.validateInput(sessionId, input);
        addAgentEvent('input_validated');

        // Step 2: Process with LLM
        const result = await this.processWithLLM(sessionId, validated);
        
        // Step 3: Calculate value
        const value = await this.calculateValue(sessionId, result);

        addAgentEvent('execution_complete', {
          'output.value': value.value
        });

        return value;
      }
    );
  }

  private async processWithLLM(sessionId: string, input: any) {
    return await traceAgentInvocation(
      {
        agentId: this.agentId,
        agentName: this.name,
        lifecycleStage: this.lifecycleStage,
        version: this.version,
        sessionId
      },
      async (span) => {
        const result = await this.secureInvoke(
          sessionId,
          input,
          OutputSchema,
          { trackPrediction: true }
        );

        recordAgentConfidence(
          result.confidence_level,
          result.confidence_score,
          result.hallucination_check
        );

        recordAgentReasoning(
          result.reasoning,
          result.assumptions,
          result.data_gaps
        );

        return result;
      }
    );
  }

  private async calculateValue(sessionId: string, data: any) {
    return await traceValuePrediction(
      {
        agentId: this.agentId,
        agentName: this.name,
        lifecycleStage: this.lifecycleStage,
        version: this.version,
        sessionId
      },
      'business_value',
      async (span) => {
        const value = data.value * 1.2; // Example calculation
        
        span.setAttributes({
          'prediction.input_value': data.value,
          'prediction.output_value': value,
          'prediction.multiplier': 1.2
        });

        return { value, confidence: data.confidence };
      }
    );
  }

  private async validateInput(sessionId: string, input: any) {
    return await traceAgentExecution(
      'validateInput',
      {
        agentId: this.agentId,
        agentName: this.name,
        lifecycleStage: this.lifecycleStage,
        version: this.version,
        sessionId
      },
      async (span) => {
        // Validation logic
        const isValid = input && typeof input === 'object';
        
        span.setAttributes({
          'validation.result': isValid,
          'validation.input_type': typeof input
        });

        if (!isValid) {
          throw new Error('Invalid input');
        }

        return input;
      }
    );
  }
}
```

## Viewing Traces

### Local Development

1. Start Jaeger (or your OTLP collector):
   ```bash
   docker run -d --name jaeger \
     -p 16686:16686 \
     -p 4318:4318 \
     jaegertracing/all-in-one:latest
   ```

2. Set environment variables:
   ```bash
   export OTLP_ENDPOINT=http://localhost:4318
   export OTEL_SERVICE_NAME=valuecanvas-api
   ```

3. View traces at http://localhost:16686

### Production

Configure OTLP endpoint in environment:
```bash
OTLP_ENDPOINT=https://your-collector.example.com
OTLP_AUTH_TOKEN=your-token
```

## Troubleshooting

### Traces Not Appearing

1. Check OpenTelemetry is initialized:
   ```typescript
   import { isObservabilityEnabled } from '../../lib/observability';
   console.log('Observability enabled:', isObservabilityEnabled());
   ```

2. Verify OTLP endpoint is reachable:
   ```bash
   curl -X POST http://localhost:4318/v1/traces
   ```

3. Check logs for initialization errors

### Performance Impact

Tracing adds minimal overhead (\u003c1ms per span). If concerned:

1. Sample traces in production:
   ```typescript
   // In telemetry.ts, adjust sample rate
   tracesSampleRate: 0.1  // Sample 10% of traces
   ```

2. Disable tracing for specific operations:
   ```typescript
   if (process.env.TRACE_EXPENSIVE_OPS !== 'true') {
     return await this.expensiveOperation();
   }
   return await traceAgentExecution('expensive', ...);
   ```

## Next Steps

1. Add tracing to all lifecycle agents
2. Create Grafana dashboards for trace visualization
3. Set up alerts based on trace metrics
4. Integrate with Sentry for error correlation

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [OpenTelemetry JavaScript SDK](https://github.com/open-telemetry/opentelemetry-js)
- [Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
