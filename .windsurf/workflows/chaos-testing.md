---
description: Run chaos and resilience testing
---

# Chaos Testing Workflow

## Enable Chaos Mode

1. Start dev server with chaos enabled:

```bash
npm run chaos:enable
```

## Run Chaos Tests

// turbo 2. Run chaos test suite:

```bash
npm run test:chaos
```

3. Run chaos pipeline (comprehensive):

```bash
bash scripts/run-chaos-pipeline.sh
```

## Load Testing

4. Run load tests:

```bash
npm run test:load
```

## Resilience Verification

// turbo 5. Run resilience tests:

```bash
npx vitest run --config vitest.config.resilience.ts --passWithNoTests
```

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
