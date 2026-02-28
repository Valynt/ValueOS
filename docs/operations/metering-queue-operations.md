# Metering Queue Operations Runbook

This runbook covers operations for the JetStream-backed metering queue used by usage billing.

## Architecture

- Producers (agent and API paths) publish usage events to `metering.usage.events`.
- `billing-aggregator-worker` consumes and writes idempotently into `usage_events`.
- Idempotency key is persisted as `(tenant_id, idempotency_key)` and enforced by DB unique index.
- Messages that exhaust retries are forwarded to `metering.usage.events.dlq`.

## Queue lag monitoring

### Signals

- **JetStream consumer pending** (`num_pending`) on durable consumer `billing-aggregator`.
- **DLQ stream growth** on `METERING_USAGE_EVENTS_DLQ`.
- **Worker health endpoint** (`/`) response includes queue lag.

### Recommended alerts

- Warning: `num_pending > 5,000` for 5 minutes.
- Critical: `num_pending > 20,000` for 10 minutes.
- Critical: DLQ message count increases continuously for 15 minutes.

### Quick checks

```bash
kubectl -n valynt get pods -l app=billing-aggregator-worker
kubectl -n valynt logs deploy/billing-aggregator-worker --tail=200
kubectl -n valynt port-forward svc/metering-nats 8222:8222
curl -s http://localhost:8222/jsz?consumers=true | jq
```

## Replay from dead letter queue

1. Confirm root cause is fixed (schema, Supabase credentials, or validation bug).
2. Snapshot DLQ for audit.
3. Replay messages to primary subject.

Example replay script (run from a trusted operator shell with NATS CLI):

```bash
nats --server nats://metering-nats.valynt.svc.cluster.local:4222 consumer next METERING_USAGE_EVENTS_DLQ replay --count=100 --raw \
  | nats --server nats://metering-nats.valynt.svc.cluster.local:4222 pub metering.usage.events -
```

4. Verify consumption drain and `usage_events` inserts.
5. Acknowledge/delete replayed DLQ messages once validated.

## Failure handling

### Producer failures

- Producers log enqueue failures with `tenantId`, `metric`, and `requestId`.
- Immediate action: verify `metering-nats` service and network policy egress.

### Consumer failures

- Worker uses JetStream retries (`max_deliver`) and configured backoff (`METERING_USAGE_BACKOFF_MS`).
- After max attempts, message is moved to DLQ with failure metadata.

### Database write failures

- Worker NAKs message for retry.
- Idempotent `upsert` on `(tenant_id,idempotency_key)` guarantees exactly-once effect for committed rows.

### Recovery checklist

1. Ensure `metering-nats` and `billing-aggregator-worker` are healthy.
2. Confirm Supabase connectivity and service-role secret validity.
3. Check lag trend and scale worker replicas if needed.
4. Drain/replay DLQ once the fault is fixed.
