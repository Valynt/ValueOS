# External Integrations API Documentation

This guide describes how external systems can integrate with ValueCanvas to trigger lifecycle workflows, fetch documentation, and ingest telemetry.

## Authentication
- **Method**: Bearer tokens generated per workspace.
- **Header**: `Authorization: Bearer <token>`
- **Scopes**:
  - `lifecycle:trigger` — run agents and orchestrations
  - `docs:read` — fetch documentation pages and metadata
  - `telemetry:write` — push realization/telemetry events

## Base URLs
- **Production**: `https://api.valuecanvas.com/v1`
- **Sandbox**: `https://sandbox-api.valuecanvas.com/v1`

## Endpoints
### Trigger Lifecycle Workflow
`POST /lifecycle/runs`
- **Payload**:
```json
{
  "stage": "opportunity|target|realization|expansion",
  "accountId": "uuid",
  "inputs": { "discoveryNotes": "...", "persona": "CFO", "benchmarks": [...] }
}
```
- **Behavior**: Enqueues a workflow in the orchestrator and returns `runId` plus status URL.
- **Idempotency**: Provide `Idempotency-Key` header to avoid duplicate runs.

### Fetch Documentation Page
`GET /docs/pages/{slug}`
- **Query params**: `version` (optional, defaults to latest).
- **Response**: Page metadata, HTML/MD content, and related links.

### Submit Telemetry Event
`POST /telemetry/events`
- **Payload**:
```json
{
  "accountId": "uuid",
  "kpi": "response_time_ms",
  "value": 123,
  "timestamp": "2025-11-17T12:00:00Z",
  "metadata": { "source": "app" }
}
```
- **Behavior**: Writes to `telemetry_events` and triggers Realization Agent refresh.

## Error Handling
- Standardized error envelope:
```json
{
  "error": {
    "code": "VALIDATION_ERROR|AUTHENTICATION_ERROR|RATE_LIMIT_EXCEEDED|SERVER_ERROR",
    "message": "human-readable detail",
    "traceId": "..."
  }
}
```
- Rate limits return `429` with `Retry-After`.

## Webhooks
- **Run status updates**: Configure a webhook endpoint to receive `run.started`, `run.completed`, and `run.failed` events.
- **Security**: HMAC signatures via `X-VC-Signature`; rotate secrets quarterly.

## Versioning & Stability
- All endpoints are versioned under `/v1`; breaking changes will be introduced via `/v2` with at least 90 days' notice.
- Schema changes include `deprecationNotice` fields in responses for forward planning.
