---
description: Run chaos and resilience testing
---

# Chaos Testing Workflow

## Enable Chaos Mode

1. Start dev server with chaos enabled (if available)

## Run Chaos Tests

// turbo 2. Run chaos test suite:

```bash
bash scripts/run-chaos-pipeline.sh
```

## Load Testing

4. Run load tests:

```bash
bash scripts/load-test.sh
```

## Resilience Verification

// turbo 5. Run resilience tests (if available)

## What Chaos Tests Cover

- Network failures and latency
- Service unavailability
- Database connection issues
- Memory pressure
- Concurrent request handling

## Review Results

- Check logs for recovered errors
- Verify graceful degradation
- Confirm no data corruption
- Review response times under load
