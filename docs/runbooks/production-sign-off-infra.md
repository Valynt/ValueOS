> **Legacy section (`[legacy-id]`):** If you are operating a pre-rename cluster that still uses `valynt` namespaces/configmaps, substitute those resource names for the commands below and record the override in the change ticket.

# Production Sign-Off: Infra Deployment Steps

Covers Condition 1 (NATS JetStream) and Condition 7 (OTel collector + billing worker scraping).
Run these steps against the target cluster before opening customer traffic.

---

## Condition 1 — Deploy NATS JetStream

The `nats-jetstream.yaml` manifest is already in `infra/k8s/base/kustomization.yaml`.
It was not applied to the cluster. Apply the full base kustomization:

```bash
# Confirm cluster context
kubectl config current-context

# Apply base manifests (includes nats-jetstream.yaml and billing-aggregator-worker-deployment.yaml)
kubectl apply -k infra/k8s/base/

# Wait for NATS StatefulSet to reach ready
kubectl rollout status statefulset/metering-nats -n valueos --timeout=120s

# Verify the service is reachable
kubectl get service metering-nats -n valueos

# Verify billing aggregator worker restarts cleanly after NATS is available
kubectl rollout restart deployment/billing-aggregator-worker -n valueos
kubectl rollout status deployment/billing-aggregator-worker -n valueos --timeout=120s

# Confirm liveness probe passes
kubectl get pods -n valueos -l app=billing-aggregator-worker
```

### End-to-end smoke test

After NATS is running, trigger one agent invocation and confirm a row appears in `usage_ledger`:

```sql
-- Run in Supabase SQL editor or psql
SELECT * FROM usage_ledger ORDER BY created_at DESC LIMIT 5;
```

Also confirm the dead-letter table is empty (no events lost during the pre-deployment window):

```sql
SELECT COUNT(*) FROM dead_letter_events;
```

If `dead_letter_events` has rows, drain them:

```bash
# Call the retry endpoint (adjust URL to your backend)
curl -X POST https://api.valueos.com/internal/metering/retry-dead-letter \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN"
```

---

## Condition 7 — Deploy OTel Collector + Billing Worker ServiceMonitor

### Deploy the OTel collector

```bash
# Create the observability namespace if it doesn't exist
kubectl apply -f infra/k8s/observability/namespace.yaml

# Deploy the OTel collector
kubectl apply -f infra/k8s/observability/otel-collector/

# Wait for the collector to reach ready
kubectl rollout status deployment/otel-collector -n observability --timeout=120s

# Verify the collector is receiving spans (check logs for incoming OTLP data)
kubectl logs -n observability deployment/otel-collector --tail=50
```

### Confirm backend OTLP endpoint

Verify `OTEL_EXPORTER_OTLP_ENDPOINT` in the backend deployment points to the collector:

```bash
kubectl get configmap valueos-config -n valueos -o yaml | grep OTEL
# Expected: http://otel-collector.observability.svc.cluster.local:4318
```

If not set, patch the configmap or deployment env:

```bash
kubectl set env deployment/backend \
  OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.observability.svc.cluster.local:4318 \
  -n valueos
```

### Deploy the billing worker ServiceMonitor

```bash
kubectl apply -f infra/k8s/monitoring/billing-worker-service-monitor.yaml

# Verify the ServiceMonitor was picked up by Prometheus
kubectl get servicemonitor billing-aggregator-worker -n valueos
```

### Verify end-to-end tracing

Trigger a request and confirm a trace appears in the tracing backend (Tempo/Jaeger):

```bash
curl -X POST https://api.valueos.com/api/agent/invoke \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentType": "opportunity", "input": "smoke test"}'
```

Check the tracing UI for a trace from `valueos-backend` within 30 seconds.

### Adjusting the sample rate during incidents

The default production sample rate is 10% (`OTEL_TRACES_SAMPLER_ARG=0.1`).
To temporarily increase it for incident investigation:

```bash
# Increase to 100% sampling
kubectl set env deployment/backend OTEL_TRACES_SAMPLER_ARG=1.0 -n valueos
kubectl rollout status deployment/backend -n valueos

# Restore to 10% after investigation
kubectl set env deployment/backend OTEL_TRACES_SAMPLER_ARG=0.1 -n valueos
kubectl rollout status deployment/backend -n valueos
```

---

## Post-deployment verification checklist

- [ ] `kubectl get statefulset metering-nats -n valueos` → `READY 1/1`
- [ ] `kubectl get pods -n valueos -l app=billing-aggregator-worker` → `Running`
- [ ] Billing worker health endpoint responds: `curl http://<pod-ip>:8082/` → `{"status":"ok"}`
- [ ] `kubectl get deployment otel-collector -n observability` → `READY 1/1`
- [ ] A test agent invocation produces a row in `usage_ledger` within 30s
- [ ] A test request produces a trace in the tracing UI
- [ ] `kubectl get servicemonitor billing-aggregator-worker -n valueos` → exists
- [ ] Prometheus scrape of `/metrics` on the billing worker returns `billing_usage_records_unaggregated`
- [ ] No Redis keys matching `llm:cache:<model>:` (without tenant UUID) exist after startup flush
