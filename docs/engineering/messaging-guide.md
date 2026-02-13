# Messaging Guide

**Last Updated**: 2026-02-08

**Consolidated from 3 source documents**

---

## Table of Contents

1. [Queue observability and runbook](#queue-observability-and-runbook)
2. [Messaging scale-out and rollout strategy](#messaging-scale-out-and-rollout-strategy)
3. [Event contracts and schemas](#event-contracts-and-schemas)

---

## Queue observability and runbook

*Source: `engineering/messaging/queue-observability.md`*

## Metrics

- `broker.events.published` / `broker.events.consumed`: success throughput by event name.
- `broker.events.failed`: failures routed to retry/DLQ; alert if non-zero over 5 minutes.
- `broker.event.processing_ms`: histogram to track handler latency and surface long-running exports or webhook calls.
- Redis health: monitor `redis_up`, memory usage, and stream length (`xlen valuecanvas.events`).

## Tracing

- Wrap producers/consumers with existing OpenTelemetry tracer to add `event.name`, `idempotencyKey`, and `attempt` attributes on spans. Use `traceLLMOperation` for downstream LLM work triggered by events.

## Logging

- Structured logs from `RedisStreamBroker` include `eventName`, `messageId`, and DLQ transitions. Deduplication decisions log `idempotencyKey` for auditability.

## Dashboards

- Import `grafana/dashboards/queue-observability.json` to visualize publish/consume rates, failure counts, and processing latency. Panels are designed to align with Prometheus scrape annotations on the worker Deployment.

## Runbook

1. **Elevated failures**: Check `broker.events.failed` and Redis DLQ stream. If handlers are erroring, pause deployments and replay DLQ entries after applying fixes.
2. **Growing backlog**: Inspect stream length and CPU utilization. If CPU is low, increase replica count or tune handler concurrency; if CPU is high, raise requests/limits and revisit payload sizes.
3. **Duplicate side effects**: Verify `idempotencyKey` generation in producers and TTL configuration on `valuecanvas.events:dedupe:*` keys.
4. **Webhook/email retries**: Ensure retry caps are respected; DLQ entries should include `failureReason` and payload for selective replays.

---

## Messaging scale-out and rollout strategy

*Source: `engineering/messaging/scale-out.md`*

## Kubernetes deployment model

- **Redis broker**: StatefulSet with PVC-backed storage, liveness/readiness probes, and conservative resource requests to avoid eviction.
- **Message workers**: Deployment with two replicas by default, Prometheus scrape annotations, and exec-based health checks to keep pods in the Service mesh only when the Node.js process is live.
- **HorizontalPodAutoscaler**: CPU (70%) and memory (75%) targets scale workers between 1–5 replicas. For high-traffic events, increase limits and add custom metrics for stream lag once available.

## Rollout and resilience

- Use rolling updates with `maxUnavailable=1` (set via higher-level kustomize/Helm) to keep at least one worker serving during deploys.
- Brokers should be upgraded using partitioned failover (one pod at a time) to preserve stream state.
- Before deploys, drain workers with `kubectl rollout restart deploy/message-worker` and wait for in-flight messages to ack, preventing duplicate processing.

## Autoscaling triggers

- **CPU utilization**: primary signal for LLM post-processing or JSON serialization overhead.
- **Memory utilization**: protects workers from heap pressure during large payload fan-out.
- **Backlog observation**: monitor `valuecanvas.events` stream length and DLQ growth; add custom metrics to drive autoscaling when CPU is low but lag is high.

## Beyond docker-compose

- Keep Redis running as a managed service or StatefulSet; workers scale horizontally without changing application containers.
- Use dedicated namespaces and network policies to isolate messaging traffic from the public API surface.
- For multi-tenant isolation, shard streams per tenant (`valuecanvas.events.<tenant>`) and scale workers by shard ownership.

---

## Event contracts and schemas

*Source: `engineering/messaging/event-schemas.md`*

All brokered messages use JSON payloads with explicit versions to enable schema evolution. Each event includes:

- `schemaVersion`: semantic version string (e.g., `1.0.0`).
- `idempotencyKey`: unique key per logical action so consumers can safely deduplicate.
- `emittedAt`: ISO 8601 timestamp from the producer.
- Event-specific payload fields described below.

## Event catalog

| Event name                       | Purpose                                                               | Required fields                                                                                                                   | Version notes                                                              |
| -------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `notifications.email.requested`  | Send templated transactional email with metadata for audit/analytics. | `tenantId`, `recipient`, `template`, `variables`, `schemaVersion`, `idempotencyKey`, `emittedAt`                                  | Add optional attachments via `variables` to avoid breaking changes.        |
| `notifications.webhook.dispatch` | Deliver signed webhook payloads to partner endpoints.                 | `tenantId`, `targetUrl`, `body`, `signature`, `schemaVersion`, `idempotencyKey`, `emittedAt`, optional `retryCount`               | If retry policies change, bump minor version and add `policy` block.       |
| `data.export.requested`          | Kick off potentially long-running CSV/PDF exports.                    | `tenantId`, `exportType`, `requestedBy`, `filters`, `schemaVersion`, `idempotencyKey`, `emittedAt`, optional `notifyOnCompletion` | Include export destination details in `notifyOnCompletion` envelope.       |
| `billing.usage.reported`         | Persist metering snapshots outside request/response cycle.            | `tenantId`, `periodStart`, `periodEnd`, `usage`, `schemaVersion`, `idempotencyKey`, `emittedAt`                                   | Treat `usage` as a map of numeric counters to keep backward compatibility. |

## Schema governance

- **Validation**: Producers and consumers validate payloads against shared Zod schemas before publishing/processing. Invalid payloads are rejected before hitting the broker.
- **Versioning**: Breaking field removals/renames require a major version bump. Additive fields increment the minor version and stay backward compatible.
- **Idempotency**: Producers must set a deterministic `idempotencyKey` (e.g., Stripe event ID, export request hash, user+timestamp tuple). Consumers store processed keys with a TTL to prevent duplicate side effects.
- **Dead-lettering**: After the configured `maxDeliveries`, messages are copied to `<stream>:dlq` with `failureReason` and `lastError` so operators can replay safely once issues are resolved.

---