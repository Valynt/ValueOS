# Runbook: RuntimeServiceSpanMissingTenantTag

**Alert:** `RuntimeServiceSpanMissingTenantTag`
**Severity:** Critical
**Team:** platform-observability
**Source:** [infra/observability/prometheus/alerts/runtime-services.yml](../../infra/observability/prometheus/alerts/runtime-services.yml)

## Symptom

Runtime service spans are arriving without the `tenant_id` tag. This indicates a tenant-isolation instrumentation gap that could mask cross-tenant data leakage.

## Triage Checklist

1. Identify the affected service from the `service` label.
2. Determine if this is a new service or a regression in an existing one.
3. Check if the service was recently deployed or modified.

## Diagnostic Commands

```bash
# Check which service is emitting untagged spans
# Prometheus query:
# sum(rate(traces_spanmetrics_calls_total{service=~".*",tenant_id=""}[10m])) by (service)

# Check pod logs for tenant context warnings
kubectl logs -l app=<service-name> -n production --tail=500 | grep -i "tenant"

# Check if tenantContextMiddleware is applied in the service's Express app
grep -r "tenantContextMiddleware\|extractTenantId" packages/backend/src/server.ts
```

## Resolution Steps

1. **Identify the code path** emitting spans without tenant_id.
2. **Verify middleware order** — `tenantContextMiddleware` must run before request handlers.
3. **For background workers:** Ensure the worker passes `organizationId` to the OTEL span context.
4. **Fix and deploy.** This is a critical severity alert — prioritize the fix.

## Escalation

- Immediate: Notify Security lead — untagged spans are an audit finding.
- If unresolved in 1 hour → P0 incident.

## Verification

- `traces_spanmetrics_calls_total{service="<service>",tenant_id=""}` drops to 0.
- Alert resolves.
- Sample 10 recent spans in Tempo — all have non-empty `tenant_id`.
