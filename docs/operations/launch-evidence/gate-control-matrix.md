# Launch Gate Control Matrix

This control matrix maps each release gate ID to accountable ownership, CI enforcement, required artifacts, and waiver policy.

Normative launch criteria and threshold definitions remain canonical in [`docs/go-no-go-criteria.md`](../../go-no-go-criteria.md). This matrix is an operational index and must stay in lock-step with that source.

| Gate ID | Owner | CI job(s) | Pass threshold | Artifact path | Waiver policy |
|---|---|---|---|---|---|
| G1 | Platform Engineering | `pr-fast`, `main-verify`, `codeql`, `ts-error-ratchet`, `active-app-quality-gates`, `lint-runtime-packages` | All required checks pass; no open HIGH/CRITICAL CodeQL alerts | `docs/operations/launch-evidence/release-X.Y/g1-ci-pipeline-integrity.md` | No waiver (hard gate) |
| G2 | QA Lead | `unit-component-schema`, `_reusable-test.yml` (backend-services), `rls-gate` | Coverage minimums met (line/statements ≥ 75%, functions/branches ≥ 70%); zero unit/integration/RLS failures | `docs/operations/launch-evidence/release-X.Y/g2-test-coverage.json` | No waiver (hard gate) |
| G3 | QA Lead | `playwright` test run, `check-critical-skip-only.mjs` | Zero E2E failures and no `test.skip`/`test.only` for critical journeys | `docs/operations/launch-evidence/release-X.Y/g3-playwright-report/` | No waiver (hard gate) |
| G4 | Security | `main-verify` (secret scan), `check-client-bundle-secrets.sh`, `check-frontend-bundle-service-role`, `check-cve-waivers.mjs`, `secret-rotation-verification` | Zero unwaived HIGH/CRITICAL findings; DAST HIGH = 0 and DAST MEDIUM ≤ 5; no secrets detected | `docs/operations/launch-evidence/release-X.Y/g4-security-summary.md` | Waivers allowed only where explicitly permitted in `docs/go-no-go-criteria.md`; HIGH/CRITICAL waivers require Security approval |
| G5 | Backend Lead + SRE | `migration-chain-integrity`, `check-migration-rollbacks.mjs`, `check-migration-schema-consistency.mjs`, `check-migration-hygiene.mjs`, `dr-validation` | Migration chain clean; rollback coverage complete; DR validation passed within 7 days | `docs/operations/launch-evidence/release-X.Y/g5-schema-data-integrity.md` | No waiver for missing rollback, failed migration integrity, or stale DR validation |
| G6 | Platform Engineering + SRE | `unit-component-schema`, `terraform.yml`, `validate-k8s-security-policies.mjs` | All critical manifests validated; K8s schema/security checks pass; Terraform plan clean | `docs/operations/launch-evidence/release-X.Y/g6-infrastructure-readiness.md` | No waiver (hard gate) |
| G7 | SRE | `check-critical-service-observability-links.mjs`, `check-alert-runbooks.mjs` | Observability link and runbook checks pass; on-call and escalation readiness verified | `docs/operations/launch-evidence/release-X.Y/g7-observability-readiness.md` | Release Manager exception allowed with documented mitigation and SRE sign-off |
| G8 | Compliance + Security | `check-control-status-critical.mjs`, `check-ci-security-control-matrix.mjs`, `test:rls`, `access-review-automation` | Critical controls pass; control matrix current; tenant isolation/access review complete | `docs/operations/launch-evidence/release-X.Y/g8-compliance-readiness.md` | Release Manager exception allowed only for non-critical compliance drift with Compliance + Security approval |

## OpenSpec traceability

Requirements intent and design traceability should be captured in OpenSpec artifacts under `docs/specs/` (for example, `docs/specs/spec-production-readiness.md` and `docs/specs/spec-production-sign-off-remediation.md`) and referenced from release evidence, not redefined here.
