# Trace ↔ Log Correlation Verification Checklist

This checklist verifies correlation across the full backend path:

**API request → workflow node → agent call → outbound event**

## Preconditions

- OpenTelemetry is enabled (`ENABLE_TELEMETRY=true`).
- Collector logs pipeline is active (`infra/observability/otel-collector-config.yaml`).
- Grafana has access to Prometheus + Loki + Tempo datasources.

## Verification Steps

1. **Send a request with tenant + trace headers**
   - `x-organization-id: <tenant-id>`
   - `x-trace-id: <trace-id>`
   - Hit an endpoint that triggers workflow execution.

2. **Confirm API request span exists in Tempo**
   - Query by `trace_id=<trace-id>`.
   - Validate root span name starts with `http.` and includes `tenant_id` attribute.

3. **Confirm workflow node spans share trace**
   - Locate spans from execution runtime (`runtime.execution_runtime.*`).
   - Ensure `tenant_id` equals the request tenant and trace id matches root.

4. **Confirm agent invocation carries trace and tenant metadata**
   - Inspect agent span/attributes for:
     - `trace_id`
     - `tenant_id`
   - Confirm logs for agent execution include same `trace_id`.

5. **Confirm outbound MessageBus event correlation**
   - Validate `message_bus.publish` and `message_bus.deliver` spans in same trace.
   - Verify emitted event payload includes `tenant_id` and `trace_id`.

6. **Confirm structured log schema compliance**
   - In Loki, ensure each record contains:
     - `timestamp`, `severity`, `service`, `env`, `tenant_id`, `trace_id`, `span_id`, `event`, `outcome`

7. **Validate ingestion health dashboard**
   - Open `Log Ingestion Health` dashboard.
   - Confirm:
     - ingestion rate > 0 during test,
     - dropped logs = 0,
     - parse/validation failures = 0.

## Evidence to attach to release notes

- Tempo trace URL showing API → runtime → agent → MessageBus spans.
- Loki query result for same `trace_id`.
- Screenshot/export of `Log Ingestion Health` dashboard during test window.
