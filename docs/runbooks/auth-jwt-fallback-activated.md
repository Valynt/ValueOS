# Runbook: AuthJwtFallbackActivated

**Alert:** `AuthJwtFallbackActivated`
**Severity:** Critical
**Team:** security
**Source:** [infra/observability/prometheus/alerts/auth-rate-limiter.yml](../../infra/observability/prometheus/alerts/auth-rate-limiter.yml)

## Symptom

The emergency JWT fallback mode (`AUTH_FALLBACK_EMERGENCY_MODE`) has been activated. This is an incident-level security signal indicating the primary authentication path failed.

## Triage Checklist

1. **Immediately** verify this is not an attack — check for concurrent brute-force or credential stuffing.
2. Identify which pod(s) triggered the fallback.
3. Determine root cause: Supabase Auth outage? JWT secret rotation issue? Network partition?

## Diagnostic Commands

```bash
# Check which pods activated fallback
kubectl logs -l app=backend -n production --tail=500 | grep -i "fallback\|emergency\|jwt"

# Check Supabase Auth health
curl -s https://<supabase-project>.supabase.co/auth/v1/health

# Check recent auth attempts
kubectl logs -l app=backend -n production --tail=500 | grep -i "auth\|login\|token" | tail -50

# Check the metric
# Prometheus: increase(auth_fallback_activations_total[5m])
```

## Resolution Steps

1. **Contain immediately:** Verify incident metadata includes TTL and containment scope.
2. **If Supabase Auth is down:** Monitor Supabase status page. Auth requests will use fallback until primary recovers.
3. **If JWT secret was rotated incorrectly:** Re-sync the JWT secret from AWS Secrets Manager.
   ```bash
   # Verify ExternalSecret sync
   kubectl get externalsecrets -n production
   kubectl describe externalsecret supabase-jwt-secret -n production
   ```
4. **If this was triggered by an attack:** Engage incident response. Block suspicious IPs at WAF level.
5. **Once primary auth recovers:** The fallback auto-deactivates. Verify by checking the metric drops to 0.

## Escalation

- **Immediate:** This is a P0 incident by default. Page Security lead and Backend lead.
- If active attack suspected → engage SOC/incident response team.

## Verification

- `auth_fallback_activations_total` stops incrementing.
- Primary JWT validation succeeds (test with a known-good token).
- No unauthorized access detected in audit logs.
- Post-incident review scheduled.
