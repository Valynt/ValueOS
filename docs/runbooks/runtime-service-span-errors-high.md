# Runbook: RuntimeServiceSpanErrorsHigh

**Alert:** `RuntimeServiceSpanErrorsHigh`
**Severity:** Warning
**Team:** platform-observability
**Source:** [infra/observability/prometheus/alerts/runtime-services.yml](../../infra/observability/prometheus/alerts/runtime-services.yml)

## Symptom

Runtime service span error rate exceeds 0.1 errors/sec over a 10-minute window, sustained for 15 minutes.

## Triage Checklist

1. Identify the affected service from the `service` label in the alert.
2. Check recent deployments — was this service updated in the last hour?
3. Determine if the errors are from a single tenant or cross-tenant.

## Diagnostic Commands

```bash
# Check pod status
kubectl get pods -l app=<service-name> -n production

# Check pod logs for errors (last 200 lines)
kubectl logs -l app=<service-name> -n production --tail=200 | grep -i error

# Check OTEL traces for the service
# In Grafana → Explore → Tempo → service.name = "<service-name>" → status = ERROR

# Check error rate in Prometheus
# rate(traces_spanmetrics_calls_total{service="<service-name>",status_code="STATUS_CODE_ERROR"}[10m])
```

## Resolution Steps

1. **If caused by a bad deploy:** Roll back to the previous image.
   ```bash
   kubectl rollout undo deployment/<service-name> -n production
   ```
2. **If caused by a downstream dependency (DB, Redis, LLM):** Check dependency health endpoints.
   ```bash
   curl -s https://app.valynt.com/health/dependencies | jq .
   ```
3. **If caused by tenant-specific data:** Identify the tenant from trace metadata and investigate their data integrity.
4. **If intermittent:** Monitor for 30 more minutes. If errors drop below threshold, the alert will auto-resolve.

## Escalation

- If error rate continues rising after 30 minutes → page Backend lead.
- If errors affect >10% of tenants → escalate to P0 incident.

## Verification

- Error rate drops below 0.1/sec over 10-minute window.
- Alert resolves in Alertmanager.
- Spot-check 5 recent traces — no error spans.
