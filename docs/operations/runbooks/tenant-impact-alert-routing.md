---
title: Tenant-Impact Alert Routing
authoritative: true
owner: team-sre
review_cadence: monthly
last_reviewed: 2026-03-13
tags: [runbook, operations, tenant, alerting, fairness, ownership:team-sre, cadence:monthly]
escalation_path: "pagerduty://valueos-primary -> slack:#incident-response -> email:platform-leadership@valueos.com"
review_date: 2026-06-30
status: active
---

# Tenant-Impact Alert Routing and Escalation

## Scope

This runbook defines routing and escalation rules for incidents where blast radius is tenant-scoped, multi-tenant, or platform-wide.

## Alert Classification

All tenant-impact alerts must include these labels:

- `tenant_id` (when known)
- `tenant_tier`
- `scope` (`single_tenant`, `multi_tenant`, `platform_wide`)
- `severity` (`warning`, `critical`)
- `team` (owner)

## Routing Matrix

| Scope | Trigger Pattern | Primary Route | Secondary Route | Escalation Clock |
|---|---|---|---|---|
| single_tenant | One tenant deviates from baseline (latency/error/queue/spend) | Platform on-call | Tenant success manager | 15 min to ack, 60 min to mitigation plan |
| multi_tenant | 2+ tenants simultaneously breach deviation thresholds | Incident response primary rotation | Runtime + platform leadership | 10 min to ack, 30 min to mitigation plan |
| platform_wide | Widespread degradation across tiers/services | Incident commander + executive bridge | All service owners | 5 min to ack, immediate war room |

## Escalation Policy

### Single-Tenant Incident

1. On-call engineer validates tenant-specific symptoms and verifies tenant isolation controls.
2. If severity `critical` persists > 15 minutes, page tenant success and runtime owner.
3. If two or more additional tenants are affected, reclassify to `multi_tenant` and escalate.

### Multi-Tenant Incident

1. Incident response lead creates incident channel and assigns incident commander.
2. SRE engages runtime and data plane owners.
3. If issue persists > 30 minutes or affects enterprise tier, escalate to executive operations duty manager.

### Platform-Wide Incident

1. Trigger executive escalation immediately.
2. Freeze non-emergency deployments until stabilized.
3. Publish customer-facing status update every 30 minutes.

## Alertmanager Routing (Reference)

```yaml
route:
  group_by: ["alertname", "scope", "tenant_tier"]
  routes:
    - matchers:
        - scope="single_tenant"
      receiver: tenant-success-platform
    - matchers:
        - scope="multi_tenant"
      receiver: incident-response-primary
    - matchers:
        - scope="platform_wide"
      receiver: incident-commander-exec
```

## Post-Incident Requirements

- Document blast radius and impacted tenant IDs.
- Record whether throttling, quota, or fairness policy contributed.
- Add remediation actions to monthly multi-tenant review.
