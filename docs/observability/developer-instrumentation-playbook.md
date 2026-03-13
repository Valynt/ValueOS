# Developer Instrumentation Playbook

## Required tags

Every metric/log/span/error event in application code must include:

- `service`
- `env`
- `tenant_id`
- `trace_id`

## Backend runtime patterns

Use `runInTelemetrySpanAsync` from `packages/backend/src/observability/telemetryStandards.ts`.

### Good pattern (runtime service)

```ts
return runInTelemetrySpanAsync('runtime.context_store.get_execution_status', {
  service: 'context-store',
  env: process.env.NODE_ENV || 'development',
  tenant_id: organizationId,
  trace_id: `context-status-${executionId}`,
}, async () => this.executionStore.getExecutionStatus(executionId, organizationId));
```

### Good pattern (agent fabric)

Wrap `secureInvoke` paths with tenant-scoped tags and session trace correlation.

## Frontend patterns

Use `trackFrontendFlow` from `apps/ValyntApp/src/lib/observability.ts` for key user journeys:

- bootstrap
- auth/session lifecycle
- workflow submit/review

### Good pattern (frontend bootstrap)

```ts
await trackFrontendFlow('bootstrap.load_config', {
  service: 'valynt-app',
  env: import.meta.env.MODE || 'development',
  tenant_id: 'anonymous',
  trace_id: traceId,
}, async () => {
  loadConfig();
});
```

## Anti-patterns

- Missing tenant tags in spans/logs.
- Ad-hoc trace IDs that are not propagated into downstream calls.
- Emitting metrics without service/env labels.
- Initializing telemetry separately per module with conflicting service names.

## Definition of done for instrumentation

- Runtime + agent paths include required tags.
- Frontend key flow emits spans/metrics/errors with required tags.
- CI telemetry completeness checks pass.
- Dashboard and alert mapping gate passes for touched services/endpoints.
