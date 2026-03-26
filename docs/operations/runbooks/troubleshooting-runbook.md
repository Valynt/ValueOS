---
title: Troubleshooting Runbook
authoritative: true
owner: team-sre
review_cadence: monthly
last_reviewed: 2026-02-13
tags: [runbook, operations, troubleshooting, ownership:team-sre, cadence:monthly]
source_reference: ../reference/troubleshooting-reference.generated.md
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-05-31
status: active
---

# Troubleshooting Runbook

## Purpose
Authoritative incident triage flow for production issues.

## Triage Sequence
1. Classify impact (sev, tenant blast radius, critical-path impact).
2. Validate auth and tenant context propagation.
3. Validate billing event flow and webhook health.
4. Validate workflow execution queue and step logs.
5. Decide mitigate/rollback/escalate.

## Exit Criteria
- Core SLOs recover to baseline.
- Backlog drains to normal operating range.
- Incident summary and follow-ups captured.

## API rate limiter Redis degraded emergency controls

### Detection signals
- `rate_limit_backend_unavailable_total` increasing (warning if sustained for 5m, critical if sustained for 10m).
- `rate_limit_protective_503_responses_total` increasing for 5m, indicating active fail-closed protection.
- API logs containing `RATE_LIMIT_DEGRADED_PROTECTION`.

### Immediate triage
1. Confirm Redis reachability from API pods:
   - `kubectl -n <ns> exec deploy/<backend-deploy> -- redis-cli -u "$REDIS_URL" ping`
2. Verify alerting counters directly:
   - `kubectl -n <ns> exec deploy/<backend-deploy> -- sh -lc 'curl -s localhost:3001/metrics | rg "rate_limit_backend_unavailable_total|rate_limit_protective_503_responses_total"'`
3. Identify impacted mutation routes (`/api/dsr`, `/api/integrations`, `/api/teams`, `/api/billing`, authenticated writes).

### Emergency controls (ordered)
1. **Stabilize Redis** (preferred): fail over/restore Redis and confirm counter growth stops.
2. **Protective block remains enabled by default**: do not disable fail-closed controls for sensitive/authenticated mutation routes.
3. **Read-only pressure relief**: temporarily restrict non-essential write traffic at gateway/WAF for the affected tenant(s) while Redis recovers.
4. **Last-resort operator override** (`SEV-1 approval required`):
   - Set `RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK=true` only if customer impact is existential and approved by Incident Commander + Security on-call.
   - Keep override window short, record start/end timestamps, and revert immediately after Redis is healthy.
   - After reverting, verify 503 trend returns to baseline and run tenant-level abuse/audit review for the override window.

### Exit criteria for this incident class
- Redis ping stable for at least 10 minutes from API pods.
- `rate_limit_backend_unavailable_total` and `rate_limit_protective_503_responses_total` no longer increase.
- `RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK` is unset/false in runtime config.
- Incident timeline includes affected routes, tenant impact, and any temporary controls applied.

## Generated Reference
See command/reference appendix:
- [Troubleshooting Reference (Generated)](../reference/troubleshooting-reference.generated.md)
