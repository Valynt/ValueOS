---
description: Analyze and verify observability instrumentation
---

# Observability Verification Workflow

## Check Current Instrumentation

// turbo

1. Verify observability setup:

```bash
bash scripts/verify-observability.sh
```

// turbo 2. Verify LLM instrumentation:

```bash
npm run verify:llm-instrumentation
```

// turbo 3. Verify metrics collection:

```bash
tsx scripts/verify-metrics.ts
```

## Run Observability Tests

// turbo 4. Run observability test suite:

```bash
npx vitest run --config vitest.observability.config.ts
```

## Check Dashboards

5. Verify Grafana dashboards:

```bash
docker-compose -f docker-compose.observability.yml up -d
```

6. Access Grafana at http://localhost:3000

## Tracing Verification

7. Generate some trace data:

```bash
npm run dev
# Make requests to the app
```

8. Verify traces appear in collector

## Metrics Verification

9. Check metrics endpoint:

```bash
curl http://localhost:9090/metrics
```

## Alerting

10. Verify alert rules are configured:

```bash
cat grafana/provisioning/alerting/*.yaml
```

## Checklist

- [ ] OpenTelemetry traces flowing
- [ ] Metrics being collected
- [ ] LLM calls instrumented
- [ ] Dashboards showing data
- [ ] Alert rules configured
- [ ] No gaps in critical paths
