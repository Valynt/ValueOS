---
owner: team-platform
generated_at: 2026-04-08
source_commit: pending
status: active
---

# Launch Readiness Dashboard

**Last updated:** 2026-04-08  
**Decision source of truth:** [`docs/go-no-go-criteria.md`](./go-no-go-criteria.md)  
**Control matrix:** [`docs/operations/launch-evidence/gate-control-matrix.md`](./operations/launch-evidence/gate-control-matrix.md)

This dashboard tracks current release gate status only. It intentionally does **not** duplicate normative criteria, thresholds, or policy text.

## Current release status

| Gate ID | Status | Owner | Evidence package | Notes |
|---|---|---|---|---|
| G1 | 🟡 Pending validation | Platform Engineering | `docs/operations/launch-evidence/release-X.Y/g1-ci-pipeline-integrity.md` | Waiting for release SHA pin + final CI runs |
| G2 | 🟡 Pending validation | QA Lead | `docs/operations/launch-evidence/release-X.Y/g2-test-coverage.json` | Coverage and RLS report to be attached |
| G3 | 🟡 Pending validation | QA Lead | `docs/operations/launch-evidence/release-X.Y/g3-playwright-report/` | Critical journey run required against staging |
| G4 | 🟡 Pending validation | Security | `docs/operations/launch-evidence/release-X.Y/g4-security-summary.md` | Includes CVE, DAST, secret scan, waiver review |
| G5 | 🟡 Pending validation | Backend Lead + SRE | `docs/operations/launch-evidence/release-X.Y/g5-schema-data-integrity.md` | Migration and DR proof pending |
| G6 | 🟡 Pending validation | Platform Engineering + SRE | `docs/operations/launch-evidence/release-X.Y/g6-infrastructure-readiness.md` | K8s + Terraform evidence pending |
| G7 | 🟡 Pending validation | SRE | `docs/operations/launch-evidence/release-X.Y/g7-observability-readiness.md` | Alert/runbook + on-call evidence pending |
| G8 | 🟡 Pending validation | Compliance + Security | `docs/operations/launch-evidence/release-X.Y/g8-compliance-readiness.md` | Control status + access review pending |

Legend: 🟢 Pass · 🟡 Pending · 🔴 Fail · ⚪ Not started

## Release decision workflow

1. Owners update gate status in this dashboard and attach evidence artifacts.
2. Release Manager evaluates results using `docs/go-no-go-criteria.md`.
3. Final GO/NO-GO decision is recorded in the release decision issue.

## Requirements traceability

Requirements intent and remediation context belong in OpenSpec documents under `docs/specs/` (for example, `spec-production-readiness.md` and `spec-production-sign-off-remediation.md`). This dashboard should only link to those artifacts when relevant.
