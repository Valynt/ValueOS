# Governance Drift Telemetry Alerts & Runbook

This document defines on-call thresholds for governance drift telemetry emitted by `enforceRulesDetailed()`.

Related readiness standard: `docs/security-compliance/layer4-governance-drift-readiness.md`.


## Metrics

- `drift_detected_total`
- `drift_remediated_total`
- `drift_unresolved_total`
- `drift_denied_total`
- `drift_suppressed_duplicate_remediation_total`

## Alert thresholds

- **Critical:** `rate(drift_denied_total[5m]) > 2` for 10 minutes in `prod`.
- **High:** `rate(drift_unresolved_total[15m]) > 5` for 15 minutes in `prod`.
- **Warning:** `rate(drift_detected_total[30m]) > 20` and `rate(drift_remediated_total[30m]) = 0`.
- **Info:** sudden change `increase(drift_detected_total[1h]) > 3 * increase(drift_detected_total[1h] offset 24h)`.

## Triage dimensions

Every event includes:

- `driftType`
- `severity`
- `remediationAction`
- `stage`
- `actionName`
- `tenantId` (when policy permits)
- request/session correlation fields from governance logging

## Runbook

Primary runbook: `docs/operations/runbooks/governance-drift.md`.

Escalation path:

1. Confirm blast radius by `stage`, `actionName`, and `driftType`.
2. For `DENY_POLICY` spikes, validate whether a policy/config rollout occurred.
3. For unresolved drift spikes, check approval workflows and stage-sensitive payload fields.
4. For tenant-specific patterns, page tenant support + security owner.
5. For suppressed duplicate remediation spikes, treat as retry-storm precursor: inspect repeated evaluations for the same `tenantId:userId:actionName`, confirm permission propagation latency, and verify only one refresh executes per dedupe TTL window.
6. Record incident notes and link impacted request/session IDs.
