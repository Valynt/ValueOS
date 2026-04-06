# ValueOS Production Release Checklist

**Use this checklist for every production deployment.**  
Each item must be checked by a named owner. No item may be skipped without a documented exception approved by the Release Manager.

---

## Phase 1 — Pre-Release Preparation (T-5 days)

### 1.1 Code Freeze & Branch Health

- [ ] **Code freeze declared** — no new features merged to `main` after freeze timestamp
  - Owner: Engineering Lead
  - Verify: `git log --oneline main --since="<freeze-timestamp>"` shows only bugfixes/hotfixes
- [ ] **All open PRs triaged** — either merged, deferred, or closed
  - Owner: Engineering Lead
- [ ] **`main` branch protection rules verified** — required checks match `CI_CONTROL_MATRIX.md`
  - Owner: Platform Engineering
  - Command: `node scripts/ci/check-branch-protection-drift.mjs`
- [ ] **No open `priority:high` or `priority:critical` issues** in the release milestone
  - Owner: Release Manager
  - Verify: GitHub Issues milestone filter

### 1.2 Security Clearance

- [ ] **Latest CodeQL scan passed** — no open HIGH/CRITICAL alerts in GitHub Security tab
  - Owner: Security
- [ ] **Latest `pnpm audit` clean** — no unwaived HIGH/CRITICAL vulnerabilities
  - Owner: Security
  - Command: `pnpm audit --audit-level=high`
- [ ] **All CVE waivers current** — no expired waivers
  - Owner: Security
  - Command: `node scripts/ci/check-cve-waivers.mjs`
- [ ] **Gitleaks full-history scan passed** — verify latest `main-verify` run
  - Owner: Security
- [ ] **DAST scan passed on staging** — ZAP baseline shows no HIGH, ≤ 5 MEDIUM
  - Owner: Security
- [ ] **Secret rotation evidence current** — all CRITICAL secrets rotated within 90 days
  - Owner: Security
  - Verify: `secret-rotation-verification` workflow last run

### 1.3 Compliance

- [ ] **Control matrix current** — `CI_CONTROL_MATRIX.md` reflects all active controls
  - Owner: Compliance
  - Command: `node scripts/ci/check-ci-security-control-matrix.mjs`
- [ ] **Critical controls passing** — SOC2/ISO27001 critical controls all green
  - Owner: Compliance
  - Command: `node scripts/ci/check-control-status-critical.mjs`
- [ ] **RLS coverage audit current** — `docs/db/rls-coverage-audit.md` reflects current schema
  - Owner: Backend Lead
- [ ] **Access review completed** — no stale service account permissions
  - Owner: Security
  - Verify: latest `access-review-automation` workflow artifact

---

## Phase 2 — Staging Validation (T-2 days)

### 2.1 Staging Deployment

- [ ] **Staging deployment successful** — `deploy.yml` completed without errors on staging
  - Owner: Platform Engineering
  - Verify: GitHub Actions run for staging deploy
- [ ] **All 5 deploy sub-gates passed** on staging
  - [ ] Sub-gate 3a: Upstream release gates (pr-fast, main-verify, codeql, integration-supabase)
  - [ ] Sub-gate 3b: Manifest maturity ledger — all critical manifests `Validated`
  - [ ] Sub-gate 3c: Secret rotation evidence
  - [ ] Sub-gate 3d: DAST gate
  - [ ] Sub-gate 3e: Schema migration validation
  - Owner: Platform Engineering

### 2.2 Functional Validation on Staging

- [ ] **Full Vitest suite passed** — unit + integration, coverage thresholds met
  - Owner: QA Lead
  - Command: `pnpm run test`
- [ ] **Playwright E2E suite passed** — zero failing tests
  - Owner: QA Lead
  - Command: `pnpm run test:e2e`
  - Verify: All critical user journeys covered:
    - [ ] Tenant onboarding flow
    - [ ] Value model creation and submission
    - [ ] Financial model calculation
    - [ ] Approval workflow
    - [ ] Billing/subscription management
    - [ ] Auth (password + passkey)
- [ ] **RLS policy tests passed** — tenant isolation verified
  - Owner: Backend Lead
  - Command: `pnpm run test:rls`
- [ ] **Accessibility audit passed** — WCAG 2.2 AA, zero new violations
  - Owner: Frontend Lead
  - Verify: latest `nightly-governance` accessibility report

### 2.3 Performance Validation on Staging

- [ ] **Load test completed** — abbreviated 15-minute ramp test
  - Owner: SRE
  - Command: `k6 run tests/load/staging-24h.js --duration=15m`
  - Pass criteria:
    - [ ] p95 API latency ≤ 200ms at target RPS
    - [ ] Error rate ≤ 0.1%
    - [ ] No OOM kills or pod restarts
- [ ] **HPA behavior verified** — autoscaler responds correctly under load
  - Owner: SRE
- [ ] **Database connection pool stable** — no connection exhaustion under load
  - Owner: SRE

### 2.4 Data & Migration Validation

- [ ] **Migration chain integrity verified** — clean apply from zero on Postgres 15
  - Owner: Backend Lead
  - Verify: `migration-chain-integrity` workflow last run
- [ ] **All migrations have rollback files** — `check-migration-rollbacks.mjs` passes
  - Owner: Backend Lead
- [ ] **Rollback scripts tested** — at least the most recent 3 migrations rolled back and re-applied
  - Owner: Backend Lead
  - Command: `bash scripts/ci/apply-and-rollback-migrations.sh`
- [ ] **DR validation passed within last 7 days**
  - Owner: SRE
  - Verify: `dr-validation` workflow last run result
- [ ] **Backup restore verified** — latest snapshot restores cleanly
  - Owner: SRE

### 2.5 Observability Readiness

- [ ] **All dashboards updated** for new release metrics/features
  - Owner: SRE
- [ ] **All alerts have runbook links** — `check-alert-runbooks.mjs` passes
  - Owner: SRE
- [ ] **On-call rotation confirmed** — engineer on-call for deployment window
  - Owner: Engineering Manager
- [ ] **PagerDuty escalation policy current**
  - Owner: Engineering Manager

---

## Phase 3 — Production Deployment (T-0)

### 3.1 Pre-Deployment Checks (30 minutes before)

- [ ] **Staging healthy for ≥ 30 minutes** — no errors, SLOs green
  - Owner: SRE
  - Verify: Grafana staging dashboard
- [ ] **Maintenance window communicated** (if applicable)
  - Owner: Release Manager
- [ ] **Rollback plan confirmed** — team knows the rollback procedure
  - Owner: SRE
  - Reference: `docs/ci-cd-release-system.md` §3.3
- [ ] **Database backup taken** immediately before deployment
  - Owner: SRE
  - Command: Trigger manual RDS snapshot or Supabase backup
- [ ] **Current active slot identified** — note which slot (blue/green) is currently serving traffic
  - Owner: SRE
  - Command: `kubectl get configmap active-slot -n valynt -o jsonpath='{.data.slot}'`

### 3.2 Deployment Execution

- [ ] **Production deploy triggered** via `workflow_dispatch` with `environment: production`
  - Owner: Release Manager
  - Requires: 1 code-owner approval in GitHub Actions
- [ ] **All 5 deploy sub-gates passed** (verify in Actions run)
  - Owner: Platform Engineering
- [ ] **New slot deployed and ready** — all pods in Ready state before traffic switch
  - Owner: SRE
- [ ] **Smoke tests passed** against new slot (pre-traffic-switch)
  - Owner: QA Lead
- [ ] **Traffic switched** — `active-service` selector updated to new slot
  - Owner: SRE
- [ ] **Deployment event logged** in observability stack
  - Owner: SRE

### 3.3 Post-Deployment Validation (10-minute watch window)

- [ ] **p95 latency ≤ 200ms** — verify in Grafana
  - Owner: SRE
- [ ] **5xx error rate ≤ 0.1%** — verify in Grafana
  - Owner: SRE
- [ ] **Auth success rate ≥ 99.5%** — verify in Grafana
  - Owner: SRE
- [ ] **Worker queue depth normal** — verify in Grafana
  - Owner: SRE
- [ ] **No new error patterns in Loki** — scan logs for unexpected errors
  - Owner: SRE
- [ ] **Stripe webhook processing normal** (if billing changes in release)
  - Owner: Backend Lead
- [ ] **Supabase Realtime connections stable**
  - Owner: Backend Lead

### 3.4 Post-Deployment Cleanup

- [ ] **Old slot scaled to warm standby** (1 replica) after 10-minute watch window
  - Owner: SRE
- [ ] **Release notes published** — GitHub Release created with SBOM attached
  - Owner: Release Manager
- [ ] **Changeset version bump merged** (if applicable)
  - Owner: Release Manager
- [ ] **Deployment record updated** in `infra/k8s/manifest-maturity-ledger.json`
  - Owner: Platform Engineering

---

## Phase 4 — Post-Release (T+24 hours)

- [ ] **24-hour SLO review** — confirm all SLOs met since deployment
  - Owner: SRE
- [ ] **Error budget consumption reviewed** — no unexpected burn
  - Owner: SRE
- [ ] **Customer-reported issues triaged** — any new support tickets reviewed
  - Owner: Engineering Lead
- [ ] **Retrospective scheduled** (if any issues encountered)
  - Owner: Engineering Manager
- [ ] **Compliance evidence updated** — deployment artifact added to evidence bundle
  - Owner: Compliance

---

## Emergency Rollback Procedure

If Gate 4 metrics breach thresholds or a critical defect is found:

1. **Declare incident** — create PagerDuty incident, notify on-call
2. **Switch traffic back** to previous slot:
   ```bash
   kubectl patch service backend-active-service -n valynt \
     --type=merge -p '{"spec":{"selector":{"slot":"<previous-slot>"}}}'
   kubectl patch service frontend-active-service -n valynt \
     --type=merge -p '{"spec":{"selector":{"slot":"<previous-slot>"}}}'
   ```
3. **Verify rollback** — confirm SLOs recovering within 2 minutes
4. **If database migration was applied** — execute rollback SQL:
   ```bash
   psql $DATABASE_URL < infra/supabase/supabase/migrations/<timestamp>_<name>.rollback.sql
   ```
5. **Scale down failed slot** to 0 replicas
6. **File incident report** within 1 hour
7. **Root cause analysis** within 48 hours

**Target RTO:** < 60 seconds for traffic rollback  
**Target RPO:** < 1 hour (PITR available)
