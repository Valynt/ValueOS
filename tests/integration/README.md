# Integration Failure Tests

Tests for handling system-level failures across LLM, database, and network layers.

## Test Files

### LLM Failures (llm-failures.test.ts)

- Connection timeout → Retry with exponential backoff
- Rate limit (429) → Respect Retry-After header
- Invalid API key (401) → No retry, log error
- Service unavailable (503) → Exponential backoff
- Malformed response → Validate schema, return fallback

### Database Failures (database-failures.test.ts)

- Connection loss → Retry with connection pooling
- Query timeout → Cancel long-running queries
- Constraint violations:
  - Unique constraint (23505)
  - Foreign key constraint (23503)
  - Not-null constraint (23502)
- Transaction rollback → Preserve data integrity

### Network Failures (network-failures.test.ts)

- Network disconnection → Detect offline state, queue requests
- DNS resolution failure → Fallback to alternative endpoints
- Request/response corruption → Validate checksums, retry

## Running Tests

```bash
# Run all integration failure tests
npm test tests/integration

# Run specific failure type
npm test tests/integration/llm-failures.test.ts
npm test tests/integration/database-failures.test.ts
npm test tests/integration/network-failures.test.ts

# Watch mode
npm run test:watch tests/integration
```

## Test Coverage

✅ LLM Failures (3 tests)
✅ Database Failures (3 tests)
✅ Network Failures (2 tests)

**Total: 8 integration failure tests**

## Failure Handling Patterns

### Retry Strategy

```typescript
const executeWithRetry = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await delay(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
};
```

### Circuit Breaker

- Open after 5 consecutive failures
- Half-open after cooldown (60s)
- Close after successful test request

### Fallback Strategy

1. Retry with exponential backoff
2. Return cached response
3. Fallback to alternative endpoint
4. Return graceful degradation response

## Error Codes

### HTTP Status Codes

- 401 Unauthorized → Don't retry
- 403 Forbidden → Don't retry
- 429 Too Many Requests → Retry with backoff
- 503 Service Unavailable → Retry with backoff

### PostgreSQL Error Codes

- 23505 Unique violation
- 23503 Foreign key violation
- 23502 Not-null violation
