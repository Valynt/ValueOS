# Runbook: WebhookCircuitBreakerOpen / WebhookCircuitBreakerRejectingEvents

**Alerts:**

- `WebhookCircuitBreakerOpen` (Critical)
- `WebhookCircuitBreakerRejectingEvents` (Warning)

**Team:** billing-platform
**Source:** [infra/observability/prometheus/alerts/webhook-circuit-breaker.yml](../../infra/observability/prometheus/alerts/webhook-circuit-breaker.yml)

---

## WebhookCircuitBreakerOpen

### Symptom

The webhook retry circuit breaker has opened after 5 consecutive delivery failures. Webhook events will be fast-failed to the DLQ to prevent retry amplification storms.

### Impact

Revenue events (Stripe webhook callbacks, billing state changes) may be delayed until the circuit recovers. No data is lost — events are captured in the DLQ.

### Triage Checklist

1. Identify the downstream webhook endpoint that is failing.
2. Check if Stripe/payment provider is experiencing an outage.
3. Determine if the failure is network-related or application-related.

### Diagnostic Commands

```bash
# Check WebhookRetryWorker logs
kubectl logs -l app=workers -n production --tail=300 | grep -i "webhook\|circuit.*breaker\|delivery.*fail"

# Check DLQ depth for webhook events
kubectl exec -it redis-broker-primary-0 -n production -- redis-cli llen bull:webhook-retry:failed

# Check downstream endpoint health (if internal)
curl -s -o /dev/null -w "%{http_code}" https://<webhook-endpoint>/health

# Check the circuit state metric
# Prometheus: increase(webhook_circuit_breaker_open_total[5m])
```

### Resolution Steps

1. **If downstream is down:** Wait for recovery. The circuit breaker will auto-transition to half-open after the cooldown period and retry.
2. **If downstream is healthy but webhooks fail:** Check webhook payload format, authentication headers, and TLS certificate validity.
3. **If Stripe is down:** Check [status.stripe.com](https://status.stripe.com). No action needed — DLQ preserves events.
4. **Process DLQ after recovery:**
   ```bash
   # DLQ events are automatically retried when the circuit closes.
   # Monitor bull:webhook-retry:failed queue depth dropping.
   ```
5. **Force-close the circuit (emergency only):**
   ```bash
   # This should only be done if you've confirmed the downstream is healthy
   # and the circuit is stuck open. Restart the worker to reset circuit state.
   kubectl rollout restart deployment/workers -n production
   ```

### Escalation

- If circuit remains open >30 minutes → page Billing lead.
- If DLQ depth >1000 events → page Backend lead + Billing lead.
- If revenue reconciliation is affected → page Finance team.

---

## WebhookCircuitBreakerRejectingEvents

### Symptom

Events are being actively rejected due to the open circuit breaker. This indicates the downstream issue is ongoing.

### Resolution

Same as above — this alert fires while the circuit is open and actively rejecting. It auto-resolves when the circuit transitions to half-open/closed.

### Verification

- `webhook_circuit_breaker_open_total` stops incrementing.
- `webhook_circuit_breaker_rejected_total` rate drops to 0.
- DLQ depth starts decreasing as events are reprocessed.
- Verify no billing events were permanently lost by checking Stripe dashboard reconciliation.
