# Agent Error Handling Tests

Comprehensive tests for agent error handling, resilience, and fault tolerance.

## Test Files

- **circuit-breaker.test.ts** - Circuit breaker integration (3 tests)
  - Opens after 5 consecutive failures
  - Closes after successful test request
  - Falls back to cached responses

- **cost-limits.test.ts** - Cost limit enforcement (3 tests)
  - Tracks cumulative cost across calls
  - Blocks execution when limit exceeded
  - Automatic model downgrade on budget pressure

- **retry-logic.test.ts** - Retry behavior (2 tests)
  - Exponential backoff with jitter
  - Maximum retry attempts (3)
  - Retry on transient errors only

- **timeout-handling.test.ts** - Timeout management (2 tests)
  - Request timeout enforcement (default 30s)
  - Partial results on timeout
  - Timeout cancellation with AbortController

## Running Tests

```bash
# Run all agent error handling tests
npm test tests/agents

# Run specific test file
npm test tests/agents/circuit-breaker.test.ts

# Watch mode
npm run test:watch tests/agents
```

## Test Coverage

✅ Circuit Breaker Integration (3 tests)
✅ Cost Limit Enforcement (3 tests)
✅ Retry Logic (2 tests)
✅ Timeout Handling (2 tests)

**Total: 10 tests**

## Key Patterns

### Circuit Breaker

- Failure threshold: 5 consecutive failures
- Cooldown period: 60 seconds
- Fallback: Return cached response or error

### Cost Limits

- Warning: 70% of limit
- Downgrade: 85% of limit (switch to cheaper model)
- Block: 95% of limit (stop execution)

### Retry Logic

- Max attempts: 3
- Backoff: Exponential (1s, 2s, 4s, 8s, capped at 10s)
- Jitter: 0-1000ms to prevent thundering herd
- Retry on: rate_limit, timeout, service_unavailable
- No retry on: invalid_api_key, invalid_request, forbidden

### Timeouts

- OpportunityAgent: 10s
- TargetAgent: 30s
- RealizationAgent: 5s
- Default: 15s

## Notes

- Tests use mocks and stubs to simulate LLM failures
- Real integration tests would require actual LLM service
- Metrics tracking helps identify reliability issues
