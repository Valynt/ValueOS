# Queue observability and runbook

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
