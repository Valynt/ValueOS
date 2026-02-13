---
owner: Platform Operations
escalation_path: 'On-call SRE -> Incident Commander -> Head of Engineering'
review_date: '2026-06-30'
---

# On-Call Drill Scorecard

This scorecard tracks drill MTTR against incident SLO targets and is auto-published by CI.

## SLO Targets

- **SEV1 MTTR target:** 30 minutes
- **SEV2 MTTR target:** 120 minutes

## Latest Status

- **Latest reporting month:** 2026-02
- **Overall SLO status:** ❌ Needs remediation

## Drill Records

| Date | Scenario | Severity | MTTR | SLO Target | Result |
|---|---|---|---:|---:|---|
| 2026-02-11 | Third-party auth provider degradation | SEV2 | 96m | 120m | ✅ Within SLO |
| 2026-02-05 | Regional ingress outage simulation | SEV1 | 31m | 30m | ❌ Missed SLO |
| 2026-01-22 | Queue backlog recovery | SEV2 | 82m | 120m | ✅ Within SLO |
| 2026-01-08 | Primary database failover | SEV1 | 24m | 30m | ✅ Within SLO |

## MTTR Trends by Month

| Month | Drills | Avg MTTR | SEV1 MTTR | SEV2 MTTR | SLO Pass |
|---|---:|---:|---:|---:|---|
| 2026-01 | 2 | 53m | 24 | 82 | ✅ |
| 2026-02 | 2 | 63.5m | 31 | 96 | ❌ |
