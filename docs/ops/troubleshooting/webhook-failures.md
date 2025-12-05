# Webhook Failures (Delivery Errors)

**Goal:** Restore outbound webhook delivery when partners report missing callbacks or repeated retries.

## Symptoms
- Partner systems report missing events or duplicated deliveries.
- Delivery dashboard shows high retry counts or `5xx` responses.
- Queue backlog increases on the `webhook:pending` stream.

## First-Response Checklist
1. Confirm whether failures are global or scoped to a single destination URL.
2. Capture one failing delivery ID and the associated tenant/application.
3. Notify **Integrations Owner** and **On-Call SRE**; open an incident ticket.

## Triage Procedure
1. **Check delivery metrics**
   - Grafana panel `Webhooks › Success vs Failure` should show recent spikes.
   - If failures correlate with a single subscriber, proceed with targeted disablement.
2. **Inspect failing deliveries**
   - Pull latest failing attempts:
     ```sql
     SELECT id, target_url, status, error_message, attempted_at
     FROM webhook_delivery_attempts
     WHERE status = 'failed'
     ORDER BY attempted_at DESC
     LIMIT 20;
     ```
   - If the same `target_url` repeats, consider pausing that subscription.
3. **Validate signing and headers**
   - Recompute signature to confirm key drift:
     ```bash
     printf "%s" "$WEBHOOK_PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET"
     ```
   - Ensure `X-Tenant-Id` and `X-Request-Id` headers are present at the gateway.
4. **Replay from dead letter queue**
   - Identify DLQ size: `redis-cli -u "$REDIS_URL" LLEN webhook:dlq`
   - Requeue a single payload to validate path end-to-end:
     ```bash
     redis-cli -u "$REDIS_URL" RPOPLPUSH webhook:dlq webhook:pending
     ```
5. **Network and TLS checks**
   - Use mTLS health check for partners requiring client certs:
     ```bash
     curl -v --cert client.pem --key client.key https://partner.example.com/webhook/health
     ```
   - If DNS issues are suspected, test from another VPC subnet.
6. **Validate recovery**
   - Confirm `webhook:pending` length returns to baseline and success rate >99% for 15 minutes.
   - Communicate resolution and provide retry window to partners.

## Observability Queries
- **Loki (LogQL) to find failing target URLs**
  ```logql
  sum by(target) (rate({app="webhook-dispatcher", status!~"2.."} [5m]))
  ```
- **Loki to detect signature mismatches**
  ```logql
  count_over_time({app="webhook-dispatcher"} |= "signature" |= "mismatch" [10m])
  ```
- **SQL to find noisy subscriptions**
  ```sql
  SELECT subscription_id, target_url, count(*) AS failures_last_hour
  FROM webhook_delivery_attempts
  WHERE status = 'failed' AND attempted_at > now() - interval '1 hour'
  GROUP BY subscription_id, target_url
  ORDER BY failures_last_hour DESC
  LIMIT 10;
  ```

## Escalation
- If >10% of deliveries fail for more than 10 minutes, classify as P1 and coordinate rollback per `docs/ops/runbooks/rollback.md`.
- For single destination outages, disable the subscription temporarily via the admin console and inform the partner of auto-retry policy.
