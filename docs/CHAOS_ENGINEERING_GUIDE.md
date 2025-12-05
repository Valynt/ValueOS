# Chaos Engineering Guide

## Overview

Chaos Engineering is the practice of intentionally injecting failures into systems to test their resilience and identify weaknesses before they cause real outages.

## Safety First

⚠️ **IMPORTANT**: Chaos experiments should only be run in:
- Development environments
- Staging environments
- Production (with extreme caution and proper safeguards)

## Quick Start

### 1. Enable Chaos Engineering

```bash
# In development/staging
export CHAOS_ENABLED=true

# In production (requires explicit flag)
export NODE_ENV=production
export CHAOS_ENABLED=true
```

### 2. Register an Experiment

```typescript
import { chaosEngineering } from './services/ChaosEngineering';

const experimentId = chaosEngineering.registerExperiment({
  name: 'LLM Latency Test',
  description: 'Test system behavior under high LLM latency',
  enabled: true,
  probability: 0.1, // 10% of requests
  targets: {
    endpoints: ['/api/llm/chat']
  },
  failure: {
    type: 'latency',
    config: {
      delayMs: 5000 // 5 second delay
    }
  }
});
```

### 3. Run Experiment

```bash
# Start your application
npm start

# Make requests to trigger chaos
curl http://localhost:3000/api/llm/chat \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt": "test", "model": "llama-70b"}'

# Some requests will experience 5s delay
```

### 4. Monitor Results

```typescript
const stats = chaosEngineering.getExperimentStats(experimentId);
console.log(`Injections: ${stats.totalInjections}`);
console.log(`Rate: ${stats.injectionRate} per hour`);
```

## Failure Types

### 1. Latency Injection

Adds artificial delays to requests.

```typescript
chaosEngineering.registerExperiment({
  name: 'High Latency',
  enabled: true,
  probability: 0.2,
  failure: {
    type: 'latency',
    config: {
      delayMs: 3000 // 3 seconds
    }
  }
});
```

**Use Cases**:
- Test timeout handling
- Verify user experience under slow responses
- Test circuit breaker activation

### 2. Error Injection

Returns error responses.

```typescript
chaosEngineering.registerExperiment({
  name: 'Service Errors',
  enabled: true,
  probability: 0.1,
  failure: {
    type: 'error',
    config: {
      statusCode: 503,
      message: 'Service temporarily unavailable'
    }
  }
});
```

**Use Cases**:
- Test error handling
- Verify retry logic
- Test user-facing error messages

### 3. Timeout Injection

Causes requests to timeout.

```typescript
chaosEngineering.registerExperiment({
  name: 'Database Timeout',
  enabled: true,
  probability: 0.05,
  targets: {
    services: ['database']
  },
  failure: {
    type: 'timeout',
    config: {
      timeoutMs: 30000 // 30 seconds
    }
  }
});
```

**Use Cases**:
- Test timeout handling
- Verify connection pool behavior
- Test graceful degradation

### 4. Circuit Breaker Simulation

Simulates circuit breaker opening.

```typescript
chaosEngineering.registerExperiment({
  name: 'Circuit Breaker Test',
  enabled: true,
  probability: 0.1,
  failure: {
    type: 'circuit_breaker',
    config: {}
  }
});
```

**Use Cases**:
- Test fallback mechanisms
- Verify circuit breaker behavior
- Test service degradation

### 5. Rate Limit Simulation

Simulates rate limiting.

```typescript
chaosEngineering.registerExperiment({
  name: 'Rate Limit Test',
  enabled: true,
  probability: 0.1,
  failure: {
    type: 'rate_limit',
    config: {}
  }
});
```

**Use Cases**:
- Test rate limit handling
- Verify backoff strategies
- Test user messaging

### 6. Data Corruption

Corrupts response data.

```typescript
const data = { name: 'John', email: 'john@example.com' };
const corrupted = chaosEngineering.corruptData(data, {
  fields: ['email'],
  corruptionType: 'null'
});
// Result: { name: 'John', email: null }
```

**Use Cases**:
- Test data validation
- Verify error handling
- Test data recovery

## Targeting

### Target Specific Endpoints

```typescript
chaosEngineering.registerExperiment({
  name: 'LLM Endpoint Test',
  enabled: true,
  probability: 0.2,
  targets: {
    endpoints: ['/api/llm/chat', '/api/canvas/generate']
  },
  failure: {
    type: 'latency',
    config: { delayMs: 5000 }
  }
});
```

### Target Specific Services

```typescript
chaosEngineering.registerExperiment({
  name: 'Database Service Test',
  enabled: true,
  probability: 0.1,
  targets: {
    services: ['database']
  },
  failure: {
    type: 'timeout',
    config: { timeoutMs: 30000 }
  }
});
```

### Target Specific Users

```typescript
chaosEngineering.registerExperiment({
  name: 'Beta User Test',
  enabled: true,
  probability: 1.0, // Always inject for these users
  targets: {
    users: ['user-123', 'user-456']
  },
  failure: {
    type: 'latency',
    config: { delayMs: 2000 }
  }
});
```

## Scheduling

### Time-Based Scheduling

```typescript
chaosEngineering.registerExperiment({
  name: 'Business Hours Test',
  enabled: true,
  probability: 0.1,
  schedule: {
    startTime: new Date('2024-01-01'),
    endTime: new Date('2024-12-31'),
    daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
    hoursOfDay: [9, 10, 11, 12, 13, 14, 15, 16, 17] // 9 AM - 5 PM
  },
  failure: {
    type: 'latency',
    config: { delayMs: 3000 }
  }
});
```

## Middleware Integration

### Global Chaos Middleware

```typescript
import { chaosMiddleware } from './middleware/chaosMiddleware';

app.use(chaosMiddleware());
```

### Service-Specific Middleware

```typescript
import { chaosServiceMiddleware } from './middleware/chaosMiddleware';

// Apply to specific routes
app.use('/api/llm', chaosServiceMiddleware('llm'));
app.use('/api/database', chaosServiceMiddleware('database'));
```

### Function Wrapper

```typescript
import { withChaos } from './middleware/chaosMiddleware';

const fetchDataWithChaos = withChaos(
  async (id: string) => {
    return await database.query('SELECT * FROM users WHERE id = $1', [id]);
  },
  { service: 'database', operation: 'fetchUser' }
);
```

## Best Practices

### 1. Start Small

```typescript
// Start with low probability
chaosEngineering.registerExperiment({
  name: 'Initial Test',
  enabled: true,
  probability: 0.01, // 1% of requests
  // ...
});

// Gradually increase
setTimeout(() => {
  const experiment = chaosEngineering.listExperiments()
    .find(e => e.name === 'Initial Test');
  if (experiment) {
    experiment.probability = 0.05; // 5%
  }
}, 60000);
```

### 2. Monitor Closely

```typescript
setInterval(() => {
  const experiments = chaosEngineering.listExperiments();
  
  experiments.forEach(exp => {
    const stats = chaosEngineering.getExperimentStats(exp.id);
    console.log(`${exp.name}: ${stats.injectionRate} injections/hour`);
    
    // Alert if too many injections
    if (stats.injectionRate > 100) {
      console.warn(`High injection rate for ${exp.name}`);
      chaosEngineering.disableExperiment(exp.id);
    }
  });
}, 60000); // Every minute
```

### 3. Have Rollback Plan

```typescript
// Disable all experiments quickly
function emergencyStop() {
  const experiments = chaosEngineering.listExperiments();
  experiments.forEach(exp => {
    chaosEngineering.disableExperiment(exp.id);
  });
  logger.warn('All chaos experiments disabled (emergency stop)');
}

// Trigger on high error rate
if (errorRate > 0.5) {
  emergencyStop();
}
```

### 4. Document Experiments

```typescript
chaosEngineering.registerExperiment({
  name: 'LLM Latency Test - Week 47',
  description: `
    Testing system resilience under high LLM latency.
    
    Hypothesis: System should handle 5s delays gracefully with:
    - Proper timeout handling
    - User feedback
    - Circuit breaker activation
    
    Expected behavior:
    - Requests timeout after 10s
    - Circuit breaker opens after 50% failures
    - Users see loading indicator
    
    Success criteria:
    - No cascading failures
    - Error rate < 5%
    - User satisfaction > 80%
  `,
  enabled: true,
  probability: 0.1,
  // ...
});
```

### 5. Test in Stages

```bash
# Stage 1: Development
export NODE_ENV=development
export CHAOS_ENABLED=true
# Run experiments with high probability

# Stage 2: Staging
export NODE_ENV=staging
export CHAOS_ENABLED=true
# Run experiments with medium probability

# Stage 3: Production (canary)
export NODE_ENV=production
export CHAOS_ENABLED=true
# Run experiments with low probability on small user subset

# Stage 4: Production (full)
# Only after successful canary
```

## Example Experiments

### Experiment 1: LLM Provider Failure

**Goal**: Verify automatic fallback from Together.ai to OpenAI

```typescript
const experimentId = chaosEngineering.registerExperiment({
  name: 'LLM Provider Failure Test',
  description: 'Test automatic fallback to OpenAI when Together.ai fails',
  enabled: true,
  probability: 0.2,
  targets: {
    services: ['llm']
  },
  failure: {
    type: 'error',
    config: {
      statusCode: 503,
      message: 'Together.ai unavailable'
    }
  },
  schedule: {
    daysOfWeek: [1, 2, 3, 4, 5],
    hoursOfDay: [10, 11, 12, 13, 14]
  }
});

// Monitor results
setTimeout(() => {
  const stats = chaosEngineering.getExperimentStats(experimentId);
  console.log('Experiment Results:');
  console.log(`- Total injections: ${stats.totalInjections}`);
  console.log(`- Injection rate: ${stats.injectionRate}/hour`);
  
  // Check if fallback worked
  // (would need to query LLM usage logs)
}, 3600000); // After 1 hour
```

### Experiment 2: Database Connection Pool Exhaustion

**Goal**: Test behavior when database connections are exhausted

```typescript
chaosEngineering.registerExperiment({
  name: 'Database Pool Exhaustion',
  description: 'Simulate database connection pool exhaustion',
  enabled: true,
  probability: 0.1,
  targets: {
    services: ['database']
  },
  failure: {
    type: 'timeout',
    config: {
      timeoutMs: 60000 // Hold connections for 60s
    }
  }
});

// Expected behavior:
// - New requests queue up
// - Timeout after configured limit
// - Graceful error messages
// - No cascading failures
```

### Experiment 3: Cache Failure

**Goal**: Test system behavior when Redis cache is unavailable

```typescript
chaosEngineering.registerExperiment({
  name: 'Cache Unavailable',
  description: 'Test system behavior without cache',
  enabled: true,
  probability: 0.3,
  targets: {
    services: ['cache']
  },
  failure: {
    type: 'error',
    config: {
      statusCode: 503,
      message: 'Redis unavailable'
    }
  }
});

// Expected behavior:
// - System continues without cache
// - Increased LLM API calls
// - Higher latency but no errors
// - Cost increase tracked
```

## Monitoring

### Metrics to Track

```typescript
// Error rate
const errorRate = errors / totalRequests;

// Latency percentiles
const p95Latency = calculatePercentile(latencies, 95);
const p99Latency = calculatePercentile(latencies, 99);

// Circuit breaker state
const circuitBreakerOpen = checkCircuitBreaker();

// User impact
const affectedUsers = getAffectedUsers();
const userSatisfaction = getUserSatisfaction();
```

### Alerts

```typescript
// Alert on high error rate
if (errorRate > 0.1) {
  alert('High error rate during chaos experiment');
  chaosEngineering.disableExperiment(experimentId);
}

// Alert on high latency
if (p95Latency > 10000) {
  alert('High latency during chaos experiment');
}

// Alert on user impact
if (affectedUsers > 100) {
  alert('Too many users affected by chaos');
  emergencyStop();
}
```

## Troubleshooting

### Experiment Not Triggering

```typescript
// Check if enabled
const experiment = chaosEngineering.listExperiments()
  .find(e => e.id === experimentId);
console.log('Enabled:', experiment?.enabled);

// Check probability
console.log('Probability:', experiment?.probability);

// Check schedule
console.log('In schedule:', chaosEngineering['isInSchedule'](experiment));

// Check targets
console.log('Matches targets:', chaosEngineering['matchesTargets'](experiment, context));
```

### Too Many Injections

```typescript
// Reduce probability
experiment.probability = 0.01; // 1%

// Add schedule restrictions
experiment.schedule = {
  hoursOfDay: [2, 3, 4] // Only 2-4 AM
};

// Disable temporarily
chaosEngineering.disableExperiment(experimentId);
```

### Cascading Failures

```typescript
// Immediately disable all experiments
emergencyStop();

// Review logs
// Identify root cause
// Adjust experiment parameters
// Re-enable gradually
```

## Support

For issues or questions:
- Documentation: This file
- Slack: #chaos-engineering
- Email: chaos@valuecanvas.com
