# Performance & Resilience Testing Guide

## Overview

ValueCanvas implements comprehensive performance and resilience testing to ensure the system can handle production loads and recover from failures gracefully.

## Test Categories

### 1. Load Testing
- 100 concurrent users
- Read-heavy workloads
- Write-heavy workloads
- Ramp-up testing
- Sustained load testing
- Spike testing

### 2. Stress Testing
- Value tree calculations
- Agent invocations
- Complex queries
- Memory stress
- Concurrent operations

### 3. Resilience Testing
- Circuit breaker verification
- Compensation scenarios
- Database failover simulation
- Cascading failure prevention
- Recovery testing

## Load Testing

### 100 Concurrent Users Test

**Test File:** `src/test/performance/ConcurrentUserLoadTest.test.ts`

**Scenarios:**
1. **Full Workflow** - 100 users executing complete workflows
2. **Read-Heavy** - 100 users performing 50 reads each
3. **Write-Heavy** - 100 users performing 20 writes each
4. **Ramp-Up** - Gradual user addition over 10 seconds
5. **Sustained Load** - 50 users for 30 seconds
6. **Spike** - Sudden jump from 10 to 100 users

**Performance Targets:**
- Success Rate: > 90%
- P95 Response Time: < 10 seconds
- P99 Response Time: < 15 seconds
- Throughput: > 10 operations/second

**Running Tests:**
```bash
npm test -- src/test/performance/ConcurrentUserLoadTest.test.ts
```

**Example Output:**
```
100 Concurrent Users Test Results:
  Total Duration: 45000ms
  Success Rate: 95.00%
  Successful: 95, Failed: 5
  Avg Duration: 4500.00ms
  Min Duration: 2000ms
  Max Duration: 8000ms
  P50: 4200ms
  P95: 7500ms
  P99: 7900ms
```

### Read-Heavy Load Test

**Scenario:** 100 users performing 50 reads each (5000 total reads)

**Targets:**
- Reads/Second: > 1000
- Duration: < 10 seconds

**Optimization Tips:**
- Enable caching
- Use read replicas
- Implement connection pooling

### Write-Heavy Load Test

**Scenario:** 100 users performing 20 writes each (2000 total writes)

**Targets:**
- Writes/Second: > 500
- Duration: < 15 seconds

**Optimization Tips:**
- Batch writes
- Use async processing
- Implement write queues

## Value Tree Stress Testing

**Test File:** `src/test/performance/ValueTreeStressTest.test.ts`

### Test Scenarios

#### Small Trees (< 100 nodes)
- **Target:** < 10ms for calculations
- **Use Case:** Simple value propositions

#### Medium Trees (100-1000 nodes)
- **Target:** < 50ms for calculations
- **Use Case:** Standard business cases

#### Large Trees (1000+ nodes)
- **Target:** < 500ms for calculations
- **Use Case:** Complex enterprise scenarios

### Operations Tested

1. **Total Value Calculation**
   ```typescript
   const totalValue = calculator.calculateTotalValue(tree);
   ```

2. **Weighted Value Calculation**
   ```typescript
   const weightedValue = calculator.calculateWeightedValue(tree);
   ```

3. **Critical Path Finding**
   ```typescript
   const criticalPath = calculator.findCriticalPath(tree);
   ```

4. **Value Distribution**
   ```typescript
   const distribution = calculator.calculateValueDistribution(tree);
   ```

5. **ROI Calculation**
   ```typescript
   const roi = calculator.calculateROI(tree, cost);
   ```

### Performance Benchmarks

| Tree Size | Nodes | Depth | Target Time | Actual Time |
|-----------|-------|-------|-------------|-------------|
| Small     | 40    | 3     | 10ms        | ~5ms        |
| Medium    | 341   | 5     | 50ms        | ~30ms       |
| Large     | 3906  | 6     | 500ms       | ~300ms      |

### Running Tests

```bash
npm test -- src/test/performance/ValueTreeStressTest.test.ts
```

## Agent Invocation Benchmarks

**Test File:** `src/test/performance/AgentInvocationBenchmark.test.ts`

### Agent Categories

1. **Fast Agents** (< 50ms)
   - Simple operations
   - Cached responses
   - Target: > 20 invocations/second

2. **Medium Agents** (50-200ms)
   - Standard processing
   - Database queries
   - Target: > 5 invocations/second

3. **Slow Agents** (> 200ms)
   - Complex analysis
   - External API calls
   - Target: > 2 invocations/second

### Test Scenarios

#### Single Agent Invocation
```typescript
const agent = new MockAgent('FastAgent', 10);
for (let i = 0; i < 100; i++) {
  await agent.invoke({ iteration: i });
}
```

#### Sequential Invocation
```typescript
await orchestrator.invokeSequence(
  ['agent1', 'agent2', 'agent3'],
  input
);
```

#### Parallel Invocation
```typescript
await orchestrator.invokeParallel(
  ['agent1', 'agent2', 'agent3'],
  input
);
```

#### Concurrent Invocations
```typescript
const promises = Array.from({ length: 100 }, (_, i) =>
  agent.invoke({ id: i })
);
await Promise.all(promises);
```

### Security Overhead

**Test:** Measure overhead of secure invocation

**Expected:** < 20% overhead

**Results:**
```
Security Overhead:
  Normal: 5000ms
  Secure: 5500ms
  Overhead: 500ms (10.00%)
```

### Latency Percentiles

| Percentile | Target | Typical |
|------------|--------|---------|
| P50        | < 100ms| ~80ms   |
| P75        | < 150ms| ~120ms  |
| P90        | < 200ms| ~180ms  |
| P95        | < 250ms| ~220ms  |
| P99        | < 300ms| ~280ms  |

### Running Tests

```bash
npm test -- src/test/performance/AgentInvocationBenchmark.test.ts
```

## Resilience Testing

**Test File:** `src/test/resilience/ResilienceTests.test.ts`

### Circuit Breaker Verification

#### States

1. **CLOSED** - Normal operation
2. **OPEN** - Failing fast
3. **HALF_OPEN** - Testing recovery

#### Configuration

```typescript
const circuitBreaker = new CircuitBreaker(
  5,      // failureThreshold
  60000,  // resetTimeout (ms)
  2       // halfOpenSuccessThreshold
);
```

#### Test Scenarios

1. **Open After Failures**
   ```typescript
   // Execute 5 failing operations
   // Circuit should open
   expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
   ```

2. **Reject When Open**
   ```typescript
   // Requests should be rejected
   await expect(
     circuitBreaker.execute(operation)
   ).rejects.toThrow('Circuit breaker is OPEN');
   ```

3. **Transition to HALF_OPEN**
   ```typescript
   // After timeout, next request transitions to HALF_OPEN
   await new Promise(resolve => setTimeout(resolve, 60000));
   await circuitBreaker.execute(successOp);
   expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
   ```

4. **Close After Recovery**
   ```typescript
   // After 2 successful operations, circuit closes
   await circuitBreaker.execute(successOp);
   await circuitBreaker.execute(successOp);
   expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
   ```

### Compensation Testing

#### Scenarios

1. **Successful Compensation**
   - Workflow fails at stage 3
   - Stages 1-2 are compensated
   - All artifacts deleted

2. **Partial Compensation Failure**
   - First compensation succeeds
   - Second compensation fails
   - System logs error but continues

3. **Data Consistency**
   - All created artifacts are tracked
   - Compensation deletes all artifacts
   - No orphaned data remains

#### Example

```typescript
// Execute workflow that will fail
try {
  await integration.executeWorkflow(
    'user-1',
    { companyName: 'Test' },
    { autoCompensate: true }
  );
} catch (error) {
  // Compensation automatically triggered
}

// Verify compensation occurred
expect(deletedItems).toContain('artifact-1');
expect(deletedItems).toContain('artifact-2');
```

### Database Failover Simulation

#### Scenarios

1. **Connection Failure**
   ```typescript
   // Database connection refused
   await expect(
     integration.executeWorkflow(userId, input)
   ).rejects.toThrow('Connection refused');
   ```

2. **Transient Errors**
   ```typescript
   // Retry on transient errors
   // Should succeed after 3 attempts
   const result = await integration.executeWorkflow(userId, input);
   expect(result.status).toBe('completed');
   ```

3. **Timeout**
   ```typescript
   // Database operation times out
   await expect(
     integration.executeWorkflow(userId, input)
   ).rejects.toThrow('Timeout');
   ```

4. **Read Replica Failure**
   ```typescript
   // Fallback to primary database
   const { data } = await supabase.from('test').select('*');
   expect(data).toBeDefined();
   ```

### Cascading Failure Prevention

#### Test

```typescript
// Service A fails
for (let i = 0; i < 5; i++) {
  try { await serviceA.execute(failingOp); } catch {}
}

// Service A circuit opens
expect(serviceA.getState()).toBe(CircuitState.OPEN);

// Service B remains operational
expect(serviceB.getState()).toBe(CircuitState.CLOSED);
const result = await serviceB.execute(successOp);
expect(result).toBe('success');
```

### Recovery Testing

#### Graceful Recovery

```typescript
// Service is down
serviceHealthy = false;

// Circuit opens after failures
expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

// Service recovers
serviceHealthy = true;

// Wait for timeout
await new Promise(resolve => setTimeout(resolve, 60000));

// Circuit recovers
await circuitBreaker.execute(service);
await circuitBreaker.execute(service);
expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
```

#### Intermittent Failures

```typescript
// Service has 50% failure rate
failureRate = 0.5;

// Circuit may open and close multiple times
// Eventually recovers when service stabilizes
```

## Running All Tests

### Individual Test Suites

```bash
# Load testing
npm test -- src/test/performance/ConcurrentUserLoadTest.test.ts

# Value tree stress testing
npm test -- src/test/performance/ValueTreeStressTest.test.ts

# Agent benchmarks
npm test -- src/test/performance/AgentInvocationBenchmark.test.ts

# Resilience testing
npm test -- src/test/resilience/ResilienceTests.test.ts
```

### All Performance Tests

```bash
npm test -- src/test/performance/
```

### All Resilience Tests

```bash
npm test -- src/test/resilience/
```

### Complete Test Suite

```bash
npm test
```

## Performance Monitoring

### Metrics Collected

1. **Response Times**
   - Min, Max, Average
   - P50, P75, P90, P95, P99

2. **Throughput**
   - Operations per second
   - Requests per second

3. **Success Rates**
   - Successful operations
   - Failed operations
   - Error rates

4. **Resource Usage**
   - Memory consumption
   - CPU utilization
   - Network bandwidth

### Using Performance Monitor

```typescript
import { performanceMonitor } from './utils/performance';

// Start monitoring
performanceMonitor.startTimer('operation');

// ... perform operation ...

// Stop monitoring
performanceMonitor.stopTimer('operation');

// Get report
const report = performanceMonitor.generateReport();
console.log(report);
```

## Performance Targets

### Load Testing Targets

| Metric                | Target      | Critical |
|-----------------------|-------------|----------|
| Success Rate          | > 90%       | > 80%    |
| P95 Response Time     | < 10s       | < 15s    |
| P99 Response Time     | < 15s       | < 20s    |
| Throughput            | > 10 ops/s  | > 5 ops/s|
| Concurrent Users      | 100         | 50       |

### Value Tree Targets

| Tree Size | Target Time | Critical Time |
|-----------|-------------|---------------|
| Small     | < 10ms      | < 50ms        |
| Medium    | < 50ms      | < 100ms       |
| Large     | < 500ms     | < 1000ms      |

### Agent Invocation Targets

| Agent Type | Target Time | Critical Time |
|------------|-------------|---------------|
| Fast       | < 50ms      | < 100ms       |
| Medium     | < 200ms     | < 500ms       |
| Slow       | < 500ms     | < 1000ms      |

### Resilience Targets

| Metric                    | Target      |
|---------------------------|-------------|
| Circuit Breaker Response  | < 1ms       |
| Compensation Time         | < 5s        |
| Recovery Time             | < 60s       |
| Failure Isolation         | 100%        |

## Optimization Tips

### Load Testing

1. **Enable Caching**
   - Cache frequently accessed data
   - Use Redis or in-memory cache
   - Set appropriate TTLs

2. **Connection Pooling**
   - Reuse database connections
   - Configure pool size appropriately
   - Monitor connection usage

3. **Async Processing**
   - Use queues for heavy operations
   - Process in background
   - Return immediately to user

4. **Rate Limiting**
   - Protect against abuse
   - Prevent resource exhaustion
   - Use token bucket algorithm

### Value Tree Optimization

1. **Memoization**
   - Cache calculation results
   - Reuse for identical trees
   - Clear cache periodically

2. **Lazy Loading**
   - Load nodes on demand
   - Don't load entire tree
   - Paginate large trees

3. **Parallel Processing**
   - Calculate branches in parallel
   - Use worker threads
   - Aggregate results

### Agent Optimization

1. **Batch Processing**
   - Group similar operations
   - Process in batches
   - Reduce overhead

2. **Caching**
   - Cache agent responses
   - Use semantic caching
   - Invalidate on changes

3. **Parallel Execution**
   - Run independent agents in parallel
   - Use Promise.all()
   - Aggregate results

### Resilience Optimization

1. **Circuit Breaker Tuning**
   - Adjust failure threshold
   - Tune timeout duration
   - Monitor state transitions

2. **Retry Strategy**
   - Exponential backoff
   - Maximum retry attempts
   - Jitter to prevent thundering herd

3. **Graceful Degradation**
   - Fallback to cached data
   - Return partial results
   - Disable non-critical features

## Troubleshooting

### High Response Times

1. **Check Database**
   - Query performance
   - Index usage
   - Connection pool

2. **Check Caching**
   - Cache hit rate
   - Cache size
   - TTL settings

3. **Check Network**
   - Latency
   - Bandwidth
   - Connection issues

### Low Throughput

1. **Increase Concurrency**
   - More workers
   - Larger connection pool
   - Parallel processing

2. **Optimize Queries**
   - Add indexes
   - Reduce joins
   - Use materialized views

3. **Scale Horizontally**
   - Add more servers
   - Load balancing
   - Distributed processing

### Circuit Breaker Issues

1. **Too Sensitive**
   - Increase failure threshold
   - Increase timeout
   - Check for transient errors

2. **Not Opening**
   - Decrease failure threshold
   - Check error detection
   - Verify configuration

3. **Not Closing**
   - Decrease success threshold
   - Check service health
   - Verify recovery logic

## Resources

- [Load Testing Guide](./LOAD_TESTING.md)
- [Resilience Patterns](./RESILIENCE_PATTERNS.md)
- [Performance Monitoring](./MONITORING.md)
- [Optimization Guide](./OPTIMIZATION.md)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review test examples
3. Consult the optimization guide
4. Open an issue in the repository
