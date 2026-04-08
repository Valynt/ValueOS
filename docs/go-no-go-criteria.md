# ValueOS Production Launch — GO / NO-GO Criteria

**Purpose:** Defines the binary pass/fail criteria for production launch authorization.  
**Authority:** Release Manager holds final GO/NO-GO decision. Any single NO-GO blocks launch.  
**Process:** Each criterion is evaluated by its designated owner. Results are recorded in the launch decision record (GitHub Issue tagged `release-decision`).

---

## How to Use This Document

1. Create a GitHub Issue from `.github/ISSUE_TEMPLATE/release-go-no-go.yml` titled `Release vX.Y.Z — GO/NO-GO`
2. Each owner evaluates their criteria and posts their finding as a comment
3. Release Manager reviews all findings and posts the final GO or NO-GO decision
4. The issue is closed and linked to the GitHub Release artifact

---

## Hard Gates — Any single FAIL = NO-GO

These are non-negotiable. No exception process exists for these criteria.

Operational control mapping (owner, CI jobs, artifact paths, waiver governance): [docs/operations/launch-evidence/gate-control-matrix.md](./operations/launch-evidence/gate-control-matrix.md).

OpenSpec requirements intent and traceability: [openspec/specs/production-readiness/spec.md](../openspec/specs/production-readiness/spec.md).

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

### G1 — CI Pipeline Integrity

| Criterion | Pass condition | Verification |
|---|---|---|
| `pr-fast` required check | All lanes green on the release commit | GitHub branch protection status |
| `main-verify` required check | Passed on the release commit | GitHub Actions run |
| `codeql` required check | No open HIGH/CRITICAL alerts | GitHub Security → Code scanning |
| TypeScript error count | ≤ baseline per package (ratchet) | `ts-error-ratchet` workflow |
| Build succeeds | `pnpm run build` exits 0 | `active-app-quality-gates` lane |
| Lint clean | Zero new violations vs. baseline | `lint-runtime-packages` lane |

**Owner:** Platform Engineering  
**Evidence:** Link to passing GitHub Actions runs for the release commit SHA

---

### G2 — Test Coverage

| Criterion | Pass condition | Verification |
|---|---|---|
| Line coverage | ≥ 75% | Vitest coverage report |
| Statement coverage | ≥ 75% | Vitest coverage report |
| Function coverage | ≥ 70% | Vitest coverage report |
| Branch coverage | ≥ 70% | Vitest coverage report |
| All unit tests pass | Zero failing tests | `unit-component-schema` lane |
| All integration tests pass | Zero failing tests | `_reusable-test.yml` backend-services scope |
| RLS policy tests pass | Zero failing tests | `rls-gate` workflow |

**Owner:** QA Lead  
**Evidence:** Vitest coverage JSON artifact from the release run

---

### G3 — E2E Tests

| Criterion | Pass condition | Verification |
|---|---|---|
| Playwright E2E suite | Zero failing tests | `playwright.config.ts` run against staging |
| Critical user journeys covered | All journeys in test plan executed | Test run report |
| No flaky test suppression | No `test.skip` or `test.only` in E2E suite | `check-critical-skip-only.mjs` |

**Critical journeys that must pass:**
- Tenant registration and onboarding
- Value model creation, editing, and submission
- Financial model calculation with evidence attachment
- Approval workflow (submit → review → approve/reject)
- Billing: subscription creation, upgrade, cancellation
- Authentication: email/password login, passkey login, session expiry
- Multi-tenant isolation: user A cannot see user B's data

**Owner:** QA Lead  
**Evidence:** Playwright HTML report artifact

---

### G4 — Security

| Criterion | Pass condition | Verification |
|---|---|---|
| No HIGH/CRITICAL CVEs (unwaived) | `pnpm audit --audit-level=high` exits 0 | Audit output |
| No HIGH/CRITICAL CodeQL alerts | GitHub Security tab clean | Code scanning alerts |
| No HIGH DAST findings | ZAP baseline: 0 HIGH | ZAP report artifact |
| DAST MEDIUM findings | ≤ 5 MEDIUM | ZAP report artifact |
| No secrets in codebase | Gitleaks full-history clean | `main-verify` secret scan |
| No secrets in browser bundle | `check-client-bundle-secrets.sh` passes | CI artifact |
| No service-role keys in frontend | `check-frontend-bundle-service-role` passes | CI artifact |
| All CVE waivers current | No expired waivers | `check-cve-waivers.mjs` |
| Secret rotation current | All CRITICAL secrets rotated within 90 days | `secret-rotation-verification` |

**Owner:** Security  
**Evidence:** Security scan artifacts, CVE waiver registry, ZAP report

---

### G5 — Schema & Data Integrity

| Criterion | Pass condition | Verification |
|---|---|---|
| Migration chain integrity | Clean apply from zero on Postgres 15 | `migration-chain-integrity` workflow |
| All migrations have rollback files | `check-migration-rollbacks.mjs` passes | CI output |
| No schema drift | `check-migration-schema-consistency.mjs` passes | CI output |
| Migration naming convention | `check-migration-hygiene.mjs` passes | CI output |
| Rollback scripts tested | Last 3 migrations rolled back and re-applied successfully | Manual test record |
| DR validation passed | `dr-validation` workflow passed within last 7 days | Workflow run timestamp |
| Backup restore verified | Latest snapshot restores and passes integrity checks | DR validation artifact |

**Owner:** Backend Lead + SRE  
**Evidence:** `migration-chain-integrity` run, `dr-validation` run, rollback test record

---

### G6 — Infrastructure Readiness

| Criterion | Pass condition | Verification |
|---|---|---|
| Manifest maturity ledger | All `critical: true` manifests at `status: "Validated"` | `infra/k8s/manifest-maturity-ledger.json` |
| K8s manifests valid | `kubeconform` passes on production overlay | `unit-component-schema` lane |
| HPA configured | Backend min=2/max=18, frontend min=2/max=6 | `infra/k8s/base/hpa.yaml` |
| PodDisruptionBudgets set | Backend and frontend PDBs present | `infra/k8s/base/backend-pdb.yaml` |
| Network policies applied | Zero-trust network policies in place | `infra/k8s/base/network-policies.yaml` |
| Terraform plan clean | No unexpected resource changes | `terraform.yml` plan output |
| Kyverno policies enforced | PSA `restricted` profile active | `validate-k8s-security-policies.mjs` |

**Owner:** Platform Engineering + SRE  
**Evidence:** Manifest maturity ledger, Terraform plan artifact, K8s validation output

---

### G7 — Observability Readiness

| Criterion | Pass condition | Verification |
|---|---|---|
| All critical services have observability links | `check-critical-service-observability-links.mjs` passes | CI output |
| All alerts have runbook links | `check-alert-runbooks.mjs` passes | CI output |
| Grafana dashboards deployed | Production dashboards reflect current release | Manual verification |
| On-call rotation active | Named engineer on-call for deployment window | PagerDuty schedule |
| PagerDuty escalation policy current | Escalation chain verified | PagerDuty config |

**Owner:** SRE  
**Evidence:** Observability check CI output, PagerDuty schedule screenshot

---

### G8 — Compliance

| Criterion | Pass condition | Verification |
|---|---|---|
| Critical controls passing | `check-control-status-critical.mjs` passes | CI output |
| Control matrix current | `check-ci-security-control-matrix.mjs` passes | CI output |
| RLS coverage audit current | All tables classified in `docs/db/rls-coverage-audit.md` | Manual review |
| Tenant isolation verified | `test:rls` passes + static gate passes | CI output + link to tenant-isolation lane artifact |
| Isolation evidence links present | Release decision record includes links for RLS, vector/memory isolation, worker-context isolation artifacts | Release decision issue comments / evidence table |
| Access review completed | No stale service accounts | `access-review-automation` artifact |

**Owner:** Compliance + Security  
**Evidence:** Control status artifacts, RLS audit doc, access review artifact

---

## Release Reliability Evidence Gate (Blocking)

`reliability-indicators-gate` compiles the release reliability evidence artifact at `artifacts/reliability/release-reliability-summary.json` and blocks promotion when any threshold below is violated.

```json release-reliability-thresholds
{
  "slo_burn_rate": {
    "max_active_alerts": 0
  },
  "recent_incident_mttr": {
    "max_avg_mttr_minutes": 20
  },
  "deployment_health": {
    "minimum_critical_pass_rate_percent": 100,
    "maximum_flaky_rate_percent": 2,
    "flaky_check_name": "flake-gate",
    "critical_checks": [
      "main-verify",
      "critical-workflows-gate",
      "tenant-isolation-gate",
      "security-gate",
      "accessibility-audit",
      "flake-gate",
      "e2e-critical"
    ]
  },
  "rollback_drill": {
    "max_drill_age_days": 30
  }
}
```

---

## Soft Gates — FAIL triggers review, not automatic NO-GO

These require Release Manager judgment. A documented exception with mitigations is required to proceed.

| Criterion | Target | Current state check | Exception process |
|---|---|---|---|
| Load test p95 latency | ≤ 200ms at target RPS | k6 report | Document expected load, mitigation plan |
| Load test error rate | ≤ 0.1% | k6 report | Document error type, fix timeline |
| Accessibility violations | Zero new WCAG 2.2 AA violations | Playwright axe-core report | Document violation, remediation sprint |
| TypeScript `any` count | ≤ baseline (ratchet) | `any-ratchet.mjs` | Requires security owner sign-off |
| Debt score | ≤ baseline (ratchet) | `debt-ratchet.mjs` | Document debt, remediation sprint |
| Outdated dependencies | No packages > 2 major versions behind | `dependency-outdated` report | Document upgrade plan |

---

## Staging Dwell Requirement

**Minimum 30 minutes of healthy staging operation** before production deployment is authorized.

Staging health criteria during dwell period:
- p95 latency ≤ 200ms
- 5xx rate ≤ 0.1%
- No pod restarts
- No new error patterns in Loki

**Owner:** SRE  
**Evidence:** Grafana staging dashboard screenshot at T-30min and T-0

---

## Launch Decision Record Template (mirrors the GitHub issue template)

```markdown
## Release vX.Y.Z — GO/NO-GO

**Release commit:** <sha>
**Decision timestamp:** <ISO 8601>
**Release Manager:** <name>
**Decision:** GO ✅ / NO-GO ❌

### Gate Results

| Gate | Result | Owner | Evidence | Isolation Evidence Links (RLS / vector-memory / worker-context) |
|---|---|---|---|---|
| G1 CI Pipeline Integrity | ✅ PASS / ❌ FAIL | | | |
| G2 Test Coverage | ✅ PASS / ❌ FAIL | | | |
| G3 E2E Tests | ✅ PASS / ❌ FAIL | | | |
| G4 Security | ✅ PASS / ❌ FAIL | | | |
| G5 Schema & Data Integrity | ✅ PASS / ❌ FAIL | | | |
| G6 Infrastructure Readiness | ✅ PASS / ❌ FAIL | | | |
| G7 Observability Readiness | ✅ PASS / ❌ FAIL | | | |
| G8 Compliance | ✅ PASS / ❌ FAIL | | | |

### Soft Gate Exceptions (if any)

<document any soft gate exceptions with mitigations>

### Staging Dwell

- Staging deployed at: <timestamp>
- Staging healthy since: <timestamp>
- Dwell duration: <minutes> (minimum 30)

### Decision Rationale

<Release Manager notes>
```

---

## Automatic NO-GO Conditions

The following conditions result in an automatic NO-GO regardless of other gate results. No exception process exists.

1. Any open HIGH or CRITICAL security vulnerability without an approved waiver
2. Any failing E2E test in the critical user journey set
3. Test coverage below minimum thresholds
4. Any migration without a paired rollback file
5. `dr-validation` not passed within the last 7 days
6. Any critical K8s manifest not at `Validated` status in the maturity ledger
7. Any open `priority:critical` bug in the release milestone
8. Gitleaks detecting secrets in the release commit history
9. DAST scan showing any HIGH finding
10. `main-verify` workflow not passing on the release commit
