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
tsx scripts/verify-llm-instrumentation.ts
```

// turbo 3. Verify metrics collection:

```bash
tsx scripts/verify-metrics.ts
```

## Run Observability Tests

// turbo 4. Run observability test suite:

```bash
pnpm test
```

## Check Dashboards

5. Verify Grafana dashboards:

```bash
# Check if observability compose exists, otherwise use Makefile
make -f Makefile.observability up
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
# Check alerting files if they exist
ls grafana/provisioning/alerting/ || echo "No alerting directory found"
```

## Checklist

- [ ] OpenTelemetry traces flowing
- [ ] Metrics being collected
- [ ] LLM calls instrumented
- [ ] Dashboards showing data
- [ ] Alert rules configured
- [ ] No gaps in critical paths
