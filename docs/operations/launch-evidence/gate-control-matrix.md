---
owner: team-operations
generated_at: 2026-04-08
source_commit: HEAD
status: active
---

# Launch Gate Control Matrix

Normative gate criteria and decision authority remain in [docs/go-no-go-criteria.md](../../go-no-go-criteria.md). This matrix is the operational control mapping for ownership, CI enforcement, evidence location, and waiver governance.

OpenSpec traceability: [openspec/specs/production-readiness/spec.md](../../../openspec/specs/production-readiness/spec.md).

## Gate control matrix

| Gate ID | Owner | CI job / check | Pass threshold | Artifact path | Waiver policy |
|---|---|---|---|---|---|
| G1 | Platform Engineering | `pr-fast`, `main-verify`, `codeql`, `ts-error-ratchet`, `active-app-quality-gates`, `lint-runtime-packages` | All required checks green on release SHA; no open HIGH/CRITICAL CodeQL alerts | `artifacts/ci-lanes/` | No waivers (hard gate) |
| G2 | QA Lead | `unit-component-schema`, `_reusable-test.yml`, `rls-gate` | Coverage: lines ≥75%, statements ≥75%, functions ≥70%, branches ≥70%; zero failing unit/integration/RLS tests | `coverage/coverage-summary.json`, `artifacts/tests/`, `artifacts/rls/` | No waivers (hard gate) |
| G3 | QA Lead | Playwright E2E lane + `check-critical-skip-only.mjs` | Zero failing Playwright tests; no `test.skip`/`test.only` for critical E2E coverage | `playwright-report/`, `artifacts/e2e/` | No waivers (hard gate) |
| G4 | Security | `security-gate`, `secret-scan`, `check-cve-waivers.mjs`, bundle secret checks | 0 HIGH DAST, ≤5 MEDIUM DAST; 0 HIGH/CRITICAL unwaived dependency CVEs; no secrets detected | `artifacts/security/`, `artifacts/dast/`, `artifacts/secrets/` | CVE waivers allowed only via `docs/security-compliance/cve-waivers.json` with owner+expiry; all other criteria no waivers |
| G5 | Backend Lead + SRE | `migration-chain-integrity`, `check-migration-rollbacks.mjs`, `check-migration-schema-consistency.mjs`, `dr-validation` | Migration chain clean; all migrations have rollback; rollback/reapply verified; DR validation passed within 7 days | `artifacts/db/`, `artifacts/dr/` | No waivers (hard gate) |
| G6 | Platform Engineering + SRE | `unit-component-schema` (kubeconform), `terraform.yml`, `validate-k8s-security-policies.mjs` | All critical manifests validated; kube/terraform/security policy gates pass | `artifacts/infra/`, `infra/k8s/manifest-maturity-ledger.json` | No waivers (hard gate) |
| G7 | SRE | `check-critical-service-observability-links.mjs`, `check-alert-runbooks.mjs` + on-call verification | Required observability links and runbook mappings pass; on-call and escalation active for deployment window | `artifacts/observability/`, PagerDuty export evidence | No waivers (hard gate) |
| G8 | Compliance + Security | `check-control-status-critical.mjs`, `check-ci-security-control-matrix.mjs`, `test:rls` | Critical controls pass; control matrix consistency passes; tenant isolation evidence present with passing RLS suite | `artifacts/compliance/`, `docs/security-compliance/evidence-index.md`, `artifacts/tenant-isolation/` | No waivers (hard gate) |

```json gate-threshold-catalog
{
  "G1": "All required checks green on release SHA; no open HIGH/CRITICAL CodeQL alerts",
  "G2": "Coverage: lines >=75%, statements >=75%, functions >=70%, branches >=70%; zero failing unit/integration/RLS tests",
  "G3": "Zero failing Playwright tests; no test.skip/test.only for critical E2E coverage",
  "G4": "0 HIGH DAST, <=5 MEDIUM DAST; 0 HIGH/CRITICAL unwaived dependency CVEs; no secrets detected",
  "G5": "Migration chain clean; all migrations have rollback; rollback/reapply verified; DR validation passed within 7 days",
  "G6": "All critical manifests validated; kube/terraform/security policy gates pass",
  "G7": "Required observability links and runbook mappings pass; on-call and escalation active for deployment window",
  "G8": "Critical controls pass; control matrix consistency passes; tenant isolation evidence present with passing RLS suite"
}
```
