# ValueOS CI/CD & Release Gating System

**Audience:** Platform Engineering, SRE, Release Engineering  
**Status:** Authoritative design — supersedes ad-hoc workflow comments  
**Last reviewed:** see git log

---

## 1. System Overview

ValueOS uses a **trunk-based development** model with `main` as the single production-bound branch. Every commit to `main` is a candidate release. The pipeline enforces zero-tolerance for broken releases through five sequential gate layers before any production traffic is served.

```
PR → [Gate 0: PR Fast] → merge to main
                              │
                    ┌─────────▼──────────┐
                    │  Gate 1: main-verify│  (post-merge, full history)
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Gate 2: release   │  (reproducibility + SBOM + signing)
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Gate 3: deploy    │  (5 sequential sub-gates)
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Gate 4: post-deploy│ (smoke + DAST + canary metrics)
                    └─────────┬──────────┘
                              │
                         PRODUCTION
```

---

## 2. Pipeline Architecture

### 2.1 Gate 0 — PR Merge Gate (`pr-fast.yml`)

**Trigger:** Every PR targeting `main` or `develop`  
**Concurrency:** Cancel-in-progress per ref (fast feedback)  
**Required to merge:** All lanes must pass (enforced via branch protection)

| Lane | What it enforces | Hard gate? |
|---|---|---|
| `secret-scan` | Gitleaks diff scan — zero secrets in diff | ✅ Yes |
| `ts-type-ratchet` | TS error count ≤ baseline per package; `any` budget; debt ratchet | ✅ Yes |
| `lint-runtime-packages` | ESLint zero new warnings on backend/valynt-app/shared | ✅ Yes |
| `active-app-quality-gates` | Typecheck + build + browser-key governance per shipped app | ✅ Yes |
| `production-eslint-ratchet` | Production lint profile — allowlist + warning ratchet | ✅ Yes |
| `unit-component-schema` | Vitest coverage ≥ thresholds; migration hygiene; 60+ static guards | ✅ Yes |
| `tenant-isolation-static-gate` | Static analysis for missing `organization_id`/`tenant_id` filters | ✅ Yes |
| `security-sast` | CodeQL SAST (JavaScript/TypeScript) | ✅ Yes |
| `rls-gate` | RLS lint SQL tests via Supabase local (path-filtered) | ✅ Yes |
| `migration-chain-integrity` | Clean-apply from zero on Postgres 15 (path-filtered) | ✅ Yes |

**Coverage thresholds (hard gate — build fails if not met):**

```
lines:      75%
statements: 75%
functions:  70%
branches:   70%
```

These are enforced via `--coverage.thresholds.*` flags in the Vitest invocation. Reducing thresholds requires a PR with explicit justification reviewed by the test-coverage owner.

### 2.2 Gate 1 — Post-Merge Verification (`main-verify.yml`)

**Trigger:** Push to `main`  
**Purpose:** Catch anything that slipped through PR gate due to merge conflicts or race conditions.

- Full-history Gitleaks scan (not just diff)
- DevContainer build validation
- Re-runs critical static guards on the merged commit
- Emits `main-verify` required check status (polled by `deploy.yml`)

### 2.3 Gate 2 — Release Build (`release.yml`)

**Trigger:** Push to `main`  
**Purpose:** Produce signed, reproducible artifacts with full provenance.

**Reproducibility gate:**
1. Builds backend + frontend containers **twice independently** (`run-a`, `run-b`)
2. Compares digests — any non-allowlisted diff blocks the release
3. Allowlist for known non-deterministic layers is maintained in `scripts/ci/reproducibility-verify.mjs`

**Artifact outputs:**
- OCI images tagged `sha-<commit-sha>` pushed to GHCR
- SBOM in CycloneDX + SPDX formats (attached to GitHub Release)
- cosign signatures on all images (keyless, Sigstore)
- Changesets-driven version bump PR (if changesets present)

### 2.4 Gate 3 — Deployment Gate (`deploy.yml`)

**Trigger:** Push to `main` (auto-deploys to staging); `workflow_dispatch` for production  
**Sequential sub-gates — all must pass before `kubectl apply`:**

#### Sub-gate 3a: Upstream Release Gates
Polls until all of the following pass (90-minute timeout, 30-second interval):
- `pr-fast` (required check)
- `main-verify` (required check)
- `codeql` (required check)
- `integration-supabase` (required check)

If timeout is reached → deployment blocked, PagerDuty alert fired.

#### Sub-gate 3b: Manifest Maturity Gate
Reads `infra/k8s/manifest-maturity-ledger.json`. Blocks if any `critical: true` manifest class lacks:
- `status: "Validated"` for production deployments
- Evidence links (`rollout_artifact`, `load_test_artifact`, `rollback_artifact`)

#### Sub-gate 3c: Secret Rotation Evidence Gate
Reads open incidents from the secret rotation tracker. Blocks if any `CRITICAL` severity incident lacks rotation evidence within the last 24 hours.

#### Sub-gate 3d: DAST Gate
Runs OWASP ZAP baseline scan against the staging environment. Blocks on:
- Any `HIGH` severity finding
- More than 5 `MEDIUM` severity findings

#### Sub-gate 3e: Schema Migration Validation
Before applying migrations to the target environment:
1. Runs `check-migration-hygiene.mjs` — naming convention, format
2. Runs `check-migration-schema-consistency.mjs` — no schema drift vs. baseline
3. Runs `check-migration-rollbacks.mjs` — every migration has a paired `.rollback.sql`
4. Dry-runs migrations against a Postgres 15 service container
5. Verifies rollback scripts execute cleanly against the post-migration state

### 2.5 Gate 4 — Post-Deploy Validation

After traffic switch (see §3 for blue/green mechanics):

1. **Smoke tests** — 5-minute window, hits all critical API paths
2. **Synthetic monitoring** — Grafana synthetic checks on `/health`, `/api/v1/status`
3. **Error rate watch** — 10-minute observation window; p95 latency and 5xx rate vs. baseline
4. **Canary metrics** — if canary strategy used, compare error budget consumption between slots

Automated rollback triggers if any of the above fail (see §3.3).

---

## 3. Deployment Strategy

### 3.1 Blue/Green Deployment

ValueOS uses a **blue/green** strategy with Kubernetes selector switching.

**Infrastructure:**
```
backend-blue-deployment   (replicas: 3 prod / 1 staging)
backend-green-deployment  (replicas: 3 prod / 1 staging)
backend-active-service    (selector: slot=blue OR slot=green)

frontend-blue-deployment  (replicas: 2 prod / 1 staging)
frontend-green-deployment (replicas: 2 prod / 1 staging)
frontend-active-service   (selector: slot=blue OR slot=green)
```

**Deployment sequence:**

```
1. Identify inactive slot (e.g., green is inactive)
2. Deploy new image to inactive slot
3. Run readiness probes until all pods Ready
4. Run smoke tests against inactive slot directly (via slot-specific service)
5. Switch active-service selector to inactive slot (atomic, ~0 downtime)
6. Monitor Gate 4 metrics for 10 minutes
7. If healthy: scale down old slot to 1 replica (warm standby)
8. If unhealthy: switch selector back to old slot (rollback in <30s)
```

**Slot tracking:** Current active slot is stored in a ConfigMap `valueos/active-slot` and updated atomically with the selector switch.

### 3.2 Environment Separation

| Environment | Branch | Deploy trigger | Approval required | Data |
|---|---|---|---|---|
| `dev` | feature branches | Manual / PR preview | None | Synthetic only |
| `staging` | `main` | Automatic on merge | None | Anonymized prod snapshot |
| `production` | `main` | Manual `workflow_dispatch` | 1 code-owner approval | Live |

**Kustomize overlays:**
- `infra/k8s/overlays/staging/` — reduced replicas, staging Supabase project, relaxed HPA
- `infra/k8s/overlays/production/` — full replicas, prod Supabase project, full HPA config

**Environment promotion rule:** A commit must be healthy in staging for a minimum of **30 minutes** before production deployment is permitted. The deploy workflow enforces this via a timestamp check on the staging deployment record.

### 3.3 Rollback Plan

**Automated rollback (triggered by Gate 4 failure):**
```bash
# Switch active-service selector back to previous slot
kubectl patch service backend-active-service \
  -n valynt \
  --type=merge \
  -p '{"spec":{"selector":{"slot":"<previous-slot>"}}}'

# Same for frontend
kubectl patch service frontend-active-service \
  -n valynt \
  --type=merge \
  -p '{"spec":{"selector":{"slot":"<previous-slot>"}}}'
```
Target RTO: **< 60 seconds** for traffic rollback.

**Manual rollback procedure:**
1. Identify last known-good image digest from GHCR (immutable `sha-<commit>` tags)
2. Update inactive slot deployment to known-good image
3. Run readiness probes
4. Switch selector
5. File incident report within 1 hour

**Database rollback (see §4):** Schema rollbacks are decoupled from application rollbacks. The application must be backward-compatible with N-1 schema version for the duration of any deployment window.

---

## 4. Data Safety

### 4.1 Migration Strategy

**Naming convention:** `YYYYMMDDHHMMSS_description.sql`  
**Rollback requirement:** Every migration file must have a paired `YYYYMMDDHHMMSS_description.rollback.sql`  
**Enforcement:** `check-migration-rollbacks.mjs` blocks PRs that add migrations without rollback files.

**Migration application order:**
```
1. Pre-deploy: apply migration to staging, verify with integration tests
2. Deploy: application deployed (must be backward-compatible with old schema)
3. Post-deploy: if rollback needed, apply rollback SQL before reverting application
```

**Backward compatibility rule:** All migrations must be **expand-only** during the deployment window:
- Add columns as nullable or with defaults
- Never drop columns in the same release that removes code references
- Use the expand/contract pattern for breaking schema changes (two-release cycle)

### 4.2 Backup & Restore Validation

**Backup schedule:**
- Supabase managed backups: continuous WAL archiving + daily snapshots
- RDS (if applicable): automated snapshots every 6 hours, 30-day retention
- Point-in-time recovery (PITR) enabled with 7-day window

**Restore validation (`dr-validation.yml`):**
- Runs every Monday at 04:00 UTC
- Restores latest RDS snapshot to an isolated test instance
- Runs the full migration chain against the restored instance
- Runs RLS policy tests against restored data
- Verifies row counts and critical table checksums
- Emits a `dr-validation-report` artifact with pass/fail status

**Recovery objectives:**
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 1 hour

**Restore drill requirement:** DR validation must have passed within the last 7 days before any production deployment is approved. The deploy workflow checks the `dr-validation` workflow run status.

---

## 5. Security Scanning

### 5.1 SAST

| Tool | Scope | Trigger | Blocks merge? |
|---|---|---|---|
| CodeQL | JavaScript/TypeScript | PR + push to main | ✅ Yes |
| Semgrep | Custom rules + OWASP | Nightly + quarterly compliance export | ⚠️ Nightly alert |
| `check-security-antipatterns.mjs` | Custom ValueOS patterns | Every PR | ✅ Yes |
| `express-openapi-security-check.mjs` | Route security posture | Every PR | ✅ Yes |

### 5.2 Dependency Scanning

| Tool | Scope | Trigger | Blocks? |
|---|---|---|---|
| `pnpm audit --audit-level=high` | All workspace packages | Every PR + nightly | ✅ Yes (high/critical) |
| Trivy | Container images | Nightly + pre-deploy | ✅ Yes (critical) |
| `check-dependency-audit.mjs` | Audit result enforcement + CVE waivers | Every PR | ✅ Yes |
| `check-cve-waivers.mjs` | Waiver expiry + justification | Every PR | ✅ Yes |

**CVE waiver policy:**
- Waivers require: CVE ID, severity, justification, expiry date, security-owner sign-off
- Waivers expire after 90 days maximum
- Critical CVEs cannot be waived — must be remediated or dependency removed

### 5.3 Secret Scanning

- **Gitleaks** on every PR diff (blocks merge)
- **Gitleaks** full-history scan on every push to `main`
- **`check-llm-secrets-hygiene.mjs`** — LLM prompt/context secret hygiene
- **`check-browser-provider-secrets.mjs`** — no secrets in browser bundle
- **`check-client-bundle-secrets.sh`** — no service-role keys in frontend bundle

### 5.4 DAST

- **OWASP ZAP** baseline scan runs as part of Gate 3d (pre-production)
- Blocks on any HIGH finding or > 5 MEDIUM findings
- ZAP scan targets the staging environment with production-equivalent config

---

## 6. Observability & Alerting

### 6.1 Deployment Observability

Every deployment emits structured events to the observability stack:
- Deployment start/end timestamps
- Active slot before/after
- Image digest deployed
- Gate results (pass/fail per sub-gate)

These are queryable in Grafana via the `deployment_events` metric series.

### 6.2 Post-Deploy SLO Watch

During the 10-minute Gate 4 observation window, the following SLOs are monitored:

| SLO | Target | Rollback threshold |
|---|---|---|
| API p95 latency | ≤ 200ms | > 500ms sustained 2 min |
| HTTP 5xx rate | ≤ 0.1% | > 1% sustained 2 min |
| Worker queue depth | ≤ 1000 | > 5000 sustained 5 min |
| Auth success rate | ≥ 99.5% | < 98% sustained 2 min |

### 6.3 Runbook Links

All alerts must have a runbook link. Enforced by `check-alert-runbooks.mjs` in CI.

---

## 7. Emergency Bypass Protocol

**Scope:** Non-production only. Production emergency bypass is **blocked at the workflow level**.

**Requirements to use bypass (`skip_tests=true`):**
1. Active incident ticket ID (e.g., `INC-1234`)
2. Written justification
3. 2 code-owner approvals (S0-6 compliance)
4. Post-deploy validation checklist must be completed within 4 hours

**Audit trail:** The bypass creates an immutable GitHub Issue with:
- Incident reference
- Justification
- Deployer identity
- Timestamp
- Labels: `incident-followup`, `deferred-validation`, `priority:high`

This issue is tracked in the compliance evidence export.

---

## 8. Nightly Governance

`nightly-governance.yml` runs at 03:00 UTC daily and covers checks that are too expensive for every PR:

- Full Semgrep scan
- Full Trivy container scan
- Tenant isolation integration tests
- WCAG 2.2 AA accessibility audit
- `pnpm audit` full workspace
- DevContainer build validation
- Secret rotation age verification

Failures page the on-call engineer via PagerDuty.

---

## 9. Compliance Evidence

**Quarterly export (`compliance-evidence-export.yml`):**
- `pnpm audit` results
- Semgrep SARIF
- DSR/RLS test results
- FedRAMP control mapping
- 365-day artifact retention

**Control matrix:** `CI_CONTROL_MATRIX.md` is the single source of truth for all CI controls, their tiers, owners, and remediation pointers. `check-ci-security-control-matrix.mjs` verifies the matrix stays in sync with actual workflow jobs.

---

## 10. Gaps & Recommended Improvements

The following gaps exist in the current implementation and should be addressed before production launch:

### P0 — Must fix before production

| Gap | Current state | Required state | Owner |
|---|---|---|---|
| **E2E Playwright gate not in PR merge gate** | Playwright runs exist (`playwright.config.ts`) but are not wired into `pr-fast.yml` or `deploy.yml` as a hard gate | Add `e2e-playwright` job to `pr-fast.yml`; block deploy if any test fails | Platform Engineering |
| **Manifest maturity ledger incomplete** | All critical manifest classes show `status: "Aspirational"` with empty evidence links | All production-bound manifests must reach `status: "Validated"` with evidence artifacts | SRE |
| **DR validation not checked by deploy workflow** | `dr-validation.yml` runs independently but `deploy.yml` does not poll its result | Add DR validation recency check (≤ 7 days) as sub-gate 3f in `deploy.yml` | Platform Engineering |
| **Staging promotion hold not enforced** | No minimum dwell time in staging before production deploy | Enforce 30-minute staging health window in `deploy.yml` | Platform Engineering |

### P1 — Should fix before production

| Gap | Current state | Required state | Owner |
|---|---|---|---|
| **Load test not in release gate** | `tests/load/staging-24h.js` exists but is not wired into any gate | Run abbreviated load test (15-min ramp) as part of staging validation | SRE |
| **Canary traffic splitting not implemented** | Blue/green is all-or-nothing | Add optional canary phase (5% → 25% → 100%) with automated metric comparison | Platform Engineering |
| **SBOM attestation not verified on deploy** | SBOMs are generated but not verified at deploy time | Add cosign verify step in `deploy.yml` before `kubectl apply` | Security |
| **Migration dry-run not in deploy workflow** | Migration validation runs in PR gate but not immediately before production apply | Add migration dry-run step in `deploy.yml` sub-gate 3e | Platform Engineering |

### P2 — Improve before GA

| Gap | Current state | Required state | Owner |
|---|---|---|---|
| **No automated rollback trigger** | Rollback is documented but requires manual execution | Implement automated rollback via post-deploy metric watch + selector switch | SRE |
| **No feature flag integration** | Deployments are all-or-nothing at code level | Integrate LaunchDarkly or equivalent for progressive feature exposure | Product Engineering |
| **Chaos engineering not scheduled** | No regular fault injection | Schedule monthly chaos experiments (pod kill, network partition, DB failover) | SRE |
