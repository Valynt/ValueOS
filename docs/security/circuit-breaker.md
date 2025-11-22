# Agent Circuit Breaker Usage Guide

## Overview

The Agent Circuit Breaker (SAF-401) prevents runaway agent execution and cost overruns by enforcing hard limits on:

- **Execution Time**: Max 30 seconds per agent execution
- **LLM API Calls**: Max 20 calls per execution
- **Recursion Depth**: Max 5 levels of recursion
- **Memory Usage**: Max 100MB heap usage

## Quick Start

### Basic Usage

```typescript
import { withCircuitBreaker } from '@/lib/agent-fabric/CircuitBreaker';

// Wrap any agent execution
const result = await withCircuitBreaker(async (breaker) => {
  // Your agent logic here
  const response = await callLLM();
  return response;
});

console.log(result.result); // Agent output
console.log(result.metrics); // Execution metrics
```

### Custom Limits

```typescript
import { withCircuitBreaker } from '@/lib/agent-fabric/CircuitBreaker';

const result = await withCircuitBreaker(
  async (breaker) => {
    // Agent logic
  },
  {
    maxExecutionTime: 60000, // 60 seconds
    maxLLMCalls: 30,
    maxRecursionDepth: 10,
    enableDetailedTracking: true, // Enable debug logging
  }
);
```

## Tracking LLM Calls

```typescript
import { trackLLMCall } from '@/lib/agent-fabric/CircuitBreaker';

await withCircuitBreaker(async (breaker) => {
  // Automatically tracks and enforces LLM call limit
  const response1 = await trackLLMCall(breaker, async () => {
    return await llmGateway.complete(messages);
  });

  const response2 = await trackLLMCall(breaker, async () => {
    return await llmGateway.complete(moreMessages);
  });

  // If you exceed maxLLMCalls, SafetyError is thrown
});
```

## Tracking Recursion

```typescript
import { trackRecursion } from '@/lib/agent-fabric/CircuitBreaker';

async function recursiveAgent(breaker, depth) {
  return await trackRecursion(breaker, async () => {
    if (depth > 0) {
      return await recursiveAgent(breaker, depth - 1);
    }
    return 'done';
  });
}

await withCircuitBreaker(async (breaker) => {
  // Automatically tracks recursion depth
  await recursiveAgent(breaker, 3);
});
```

## Manual Circuit Breaker

```typescript
import { AgentCircuitBreaker } from '@/lib/agent-fabric/CircuitBreaker';

const breaker = new AgentCircuitBreaker({
  maxExecutionTime: 30000,
  maxLLMCalls: 20,
});

try {
  breaker.start();

  // Your agent logic
  breaker.recordLLMCall();
  breaker.checkMemory();

  if (breaker.shouldAbort()) {
    throw new Error('Aborted');
  }

  const metrics = breaker.complete();
  console.log('Execution completed:', metrics);
} catch (error) {
  if (error instanceof SafetyError) {
    console.error('Safety limit exceeded:', error.limit, error.value);
  }
}
```

## Integration with LLMGateway

The LLMGateway automatically integrates with the circuit breaker:

```typescript
import { LLMGateway } from '@/lib/agent-fabric/LLMGateway';

await withCircuitBreaker(async (breaker) => {
  const llm = new LLMGateway();

  // Pass circuit breaker to LLM calls
  const response = await llm.complete(
    messages,
    config,
    taskContext,
    breaker // Circuit breaker automatically tracks this call
  );
});
```

## Error Handling

```typescript
import { SafetyError } from '@/lib/agent-fabric/CircuitBreaker';

try {
  await withCircuitBreaker(async (breaker) => {
    // Agent logic that might exceed limits
  });
} catch (error) {
  if (error instanceof SafetyError) {
    console.error('Safety limit exceeded:');
    console.error('  Limit:', error.limit);
    console.error('  Value:', error.value);
    console.error('  Threshold:', error.threshold);
    console.error('  Metrics:', error.metrics);

    // Log to monitoring
    logger.error('Agent execution aborted', error, {
      limit: error.limit,
      metrics: error.metrics,
    });
  }
}
```

## Metrics

The circuit breaker tracks detailed execution metrics:

```typescript
const result = await withCircuitBreaker(async (breaker) => {
  // Agent logic
});

console.log(result.metrics);
// {
//   startTime: 1700000000000,
//   endTime: 1700000005000,
//   duration: 5000,
//   llmCallCount: 5,
//   recursionDepth: 0,
//   memoryUsed: 50000000,
//   limitViolations: [],
//   completed: true
// }
```

## Production Configuration

In production, use conservative limits:

```typescript
const PRODUCTION_LIMITS = {
  maxExecutionTime: 30000, // 30 seconds
  maxLLMCalls: 20,
  maxRecursionDepth: 5,
  maxMemoryBytes: 100 * 1024 * 1024, // 100MB
  enableDetailedTracking: false, // Disable for performance
};
```

## Testing

Run circuit breaker tests:

```bash
npm test src/lib/agent-fabric/__tests__/CircuitBreaker.test.ts
```

## Monitoring

Circuit breaker violations are automatically logged:

```typescript
// Logs include:
// - Limit that was exceeded
// - Actual value vs threshold
// - Full execution metrics
// - Stack trace (in development)

logger.error('Agent execution aborted', error, {
  limit: 'maxLLMCalls',
  value: 25,
  threshold: 20,
  metrics: { ... }
});
```

## Best Practices

1. **Always use circuit breaker for agent execution**
   - Prevents runaway costs
   - Ensures predictable performance

2. **Set appropriate limits per agent type**
   - Simple agents: Lower limits
   - Complex agents: Higher limits (but still bounded)

3. **Monitor circuit breaker violations**
   - Track which agents hit limits
   - Adjust limits or optimize agents

4. **Test with realistic workloads**
   - Ensure limits are appropriate
   - Verify error handling works

5. **Use detailed tracking in development**
   - Helps debug limit violations
   - Disable in production for performance

## Troubleshooting

### "maxExecutionTime exceeded"

- Agent is taking too long
- Increase limit or optimize agent logic
- Check for blocking operations

### "maxLLMCalls exceeded"

- Agent is making too many LLM calls
- Optimize prompts to reduce calls
- Use caching for repeated queries
- Consider using cheaper models

### "maxRecursionDepth exceeded"

- Agent has infinite recursion
- Add base case to recursive logic
- Limit recursion depth in algorithm

### "maxMemoryBytes exceeded"

- Agent is using too much memory
- Check for memory leaks
- Reduce data structure sizes
- Stream large datasets instead of loading all at once
