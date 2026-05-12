---
title: Layer 5 Production Readiness
owner: team-platform
review_date: 2026-06-30
status: active
generated_at: CI_GENERATED_UTC
source_commit: CI_SOURCE_COMMIT
---

# Layer 5 Production Readiness

## Scope
This report is the auditable readiness package for Layer 5 controls and is required release evidence for Layer 5-impacting pull requests and release candidates.

## Control Checklist

| Control area | Control | Status | Evidence | Last validated (UTC) |
| --- | --- | --- | --- | --- |
| Reliability | Release reliability indicators gate (`check-release-reliability-indicators.mjs`) | PASS | `.github/workflows/release.yml` + `scripts/ci/check-release-reliability-indicators.mjs` | CI_GENERATED_UTC |
| Scalability | HPA/KEDA scalability gate (`check-hpa-scalability-gate.mjs`) | PASS | `.github/workflows/release.yml` + `scripts/ci/check-hpa-scalability-gate.mjs` | CI_GENERATED_UTC |
| Observability | Observability/SLO contract checks (`check-observability-contract.mjs`, `check-slo-rule-metrics-contract.mjs`) | PASS | `scripts/ci/` checks + release artifacts | CI_GENERATED_UTC |
| Security | Secret scan + security baseline + anti-pattern controls | PASS | `pr-fast.yml` and security CI scripts | CI_GENERATED_UTC |

## Drift Scenarios Tested

| Scenario | Detection control | Expected behavior | Result | Timestamp (UTC) |
| --- | --- | --- | --- | --- |
| Runtime/doc drift in agent/runtime inventory | `scripts/ci/check-architecture-doc-drift.mjs` | Block merge/release until drift fixed | PASS | CI_GENERATED_UTC |
| Infra readiness drift for eventing/scalability controls | `scripts/ci/check-infra-readiness-contract.mjs` | Block merge/release and emit readiness artifact | PASS | CI_GENERATED_UTC |
| Observability metric contract drift | `scripts/ci/check-slo-rule-metrics-contract.mjs` | Block merge/release when required metrics drift | PASS | CI_GENERATED_UTC |

## Pass/Fail Status Log

| Check | Status | Timestamp (UTC) | Notes |
| --- | --- | --- | --- |
| Layer 5 report structure validation | PASS | CI_GENERATED_UTC | Required sections and alert thresholds present |
| Layer 5-impacting PR gate | PASS | CI_GENERATED_UTC | Enforced by `check-layer5-readiness-gate.mjs` |
| Release-candidate artifact generation | PASS | CI_GENERATED_UTC | Enforced by `generate-layer5-readiness-artifacts.mjs` |

## Unresolved Risks

| Risk | Impact | Owner | ETA | Mitigation status |
| --- | --- | --- | --- | --- |
| Layer 5 gate currently uses deterministic path heuristics for impact detection; false negatives are possible if new Layer 5 paths are introduced without updating the matcher. | Could allow a Layer 5-impacting PR to bypass this specific gate. | team-quality | 2026-05-31 | Open — add CODEOWNERS-aligned path registry and test coverage in CI. |
| Report timestamps and commit metadata are template placeholders injected at CI packaging time. | If injection is skipped, artifacts fail placeholder guard checks. | team-platform | 2026-05-20 | Closed — CI metadata injection and placeholder guard enforce deterministic UTC evidence fields. |

## Operational Runbook

### Strict-Mode Activation Criteria
Activate strict mode when any of the following conditions are true:
1. Two consecutive release-candidate runs fail Layer 5 report or drift checks.
2. `drift detected` alert remains firing for >15 minutes.
3. `blocked executions` exceeds threshold for two consecutive 5-minute windows.
4. Security gate failures (secrets/security baseline) coincide with Layer 5-impacting changes.

Strict mode actions:
- Require manual approval from `team-platform` and `team-security` before promotion.
- Freeze non-remediation merges to `main`.
- Increase alert sampling and on-call check-in cadence to 15 minutes.

### Drift Alert Triage
1. Confirm alert source (architecture drift, infra readiness drift, or SLO/metric drift).
2. Collect failing artifact(s) from GitHub Actions `artifacts/operations/` and `artifacts/security/`.
3. Identify owner:
   - Runtime/documentation mismatch → team-quality + owning runtime team.
   - Infra readiness mismatch → team-platform.
   - Metric contract mismatch → team-observability.
4. Create incident ticket with commit SHA, failing control, and expected vs actual.
5. If unresolved after 30 minutes, escalate via PagerDuty primary and `#incident-response`.


### Scheduled Drift Failures (GitHub Actions)
The `Layer 5 Scheduled Drift Controls` workflow runs every 6 hours (`0 */6 * * *`) and executes baseline integrity + drift contracts independent of PR/release triggers.

Operator procedure when scheduled run fails:
1. Open the failed run and download evidence artifacts:
   - `layer5-scheduled-operations-evidence-<run_id>`
   - `layer5-scheduled-security-evidence-<run_id>`
2. Review `artifacts/operations/layer5-scheduled-drift-controls.log` to identify the first failing control:
   - `check-layer5-readiness-gate.mjs --baseline`
   - `check-architecture-doc-drift.mjs`
   - `check-infra-readiness-contract.mjs`
   - `check-slo-rule-metrics-contract.mjs`
3. Confirm incident issue auto-created by workflow (`[Layer 5 Drift] Scheduled controls failed (...)`). If not present, create one manually with run URL, SHA, and failing check.
4. Assign escalation ownership immediately:
   - **Primary owner:** `team-platform` (workflow health + infra drift)
   - **Secondary owner:** `team-observability` (SLO/metrics contract drift)
   - **Secondary owner:** `team-quality` (architecture/documentation drift)
   - **Security partner:** `team-security` (security artifact evidence + compliance posture)
5. Apply remediation or rollback (see Safe Remediation / Rollback Path) and re-run the workflow manually (`workflow_dispatch`) to verify closure.
6. If unresolved after 30 minutes, escalate to PagerDuty primary and post status in `#incident-response` with artifact links.

### Safe Remediation / Rollback Path
1. Revert offending commit(s) using standard git revert flow.
2. Re-run PR Fast and release-candidate readiness jobs.
3. Confirm the following are green before re-promoting:
   - Layer 5 readiness gate
   - architecture/infra drift checks
   - reliability indicators and security baseline
4. If production was affected, execute blue/green slot rollback per deployment runbook and attach post-rollback evidence to the release record.

## Dashboards, Metrics, and Alert Thresholds

### Required dashboards
- GitHub Actions: PR Fast and Release pipelines for Layer 5 gates.
- Reliability summary artifact: `artifacts/reliability/release-reliability-summary.json`.
- Operations readiness artifact: `artifacts/operations/layer5-readiness-report-<run_id>.json`.

### Required metrics and thresholds

| Metric | Source | Threshold | Alert severity |
| --- | --- | --- | --- |
| Drift detected | Architecture/infra/SLO drift controls | >0 failing drift controls in any run | High |
| Drift unresolved | Incident tracker duration | >30 minutes unresolved | High |
| Blocked executions | Governance/runtime block counters | >5 blocked executions in 5 minutes | High |

