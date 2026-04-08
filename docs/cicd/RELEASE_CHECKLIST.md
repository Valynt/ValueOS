# Release Checklist

**Use this checklist for every production release.**  
Every item must be checked before the GO decision. Items marked ⛔ are hard blockers — no exceptions, no overrides.

---

## Phase 1 — Code readiness (PR merge gate)

These are enforced automatically by `pr-fast.yml`. A PR cannot merge unless all pass.

- [ ] ⛔ Secret scan (gitleaks diff) — 0 findings
- [ ] ⛔ TypeScript typecheck — 0 new errors (ratchet enforced)
- [ ] ⛔ ESLint — within ratchet baseline for all packages
- [ ] ⛔ Build — `valynt-app` and `@valueos/backend` build without error
- [ ] ⛔ Unit tests — all pass, no silent skips
- [ ] ⛔ RLS gate — all tenant-scoped tables have RLS enabled
- [ ] ⛔ Migration chain integrity — clean apply from zero succeeds (if migrations changed)
- [ ] ⛔ Migration rollback files — every forward migration has a `.rollback.sql`
- [ ] ⛔ CodeQL SAST — 0 new high/critical findings
- [ ] ⛔ Dependency audit — 0 high/critical CVEs in `pnpm audit`
- [ ] ⛔ service_role boundary — no request handlers import service-role clients
- [ ] ⛔ Direct LLM call guard — 0 direct `llmGateway.complete()` calls in agent code
- [ ] ⛔ Bundle secrets guard — no secrets in frontend bundle

---

## Phase 2 — Main branch verification

Enforced by `main-verify.yml` on every push to `main`.

- [ ] ⛔ Secret scan (full history) — 0 findings
- [ ] ⛔ Coverage — lines ≥ 75%, functions ≥ 70%, branches ≥ 70%
- [ ] ⛔ Agent fabric coverage — 100%
- [ ] ⛔ Security/billing coverage — ≥ 95%
- [ ] ⛔ TypeScript any-count — within ratchet baseline
- [ ] ⛔ Governance assertions — all pass (ownership, catalog, eventing architecture)
- [ ] ⛔ OpenAPI structural validation — canonical backend spec valid
- [ ] ⛔ Express ↔ OpenAPI security posture — no unprotected routes
- [ ] ⛔ Compliance control regressions — 0 regressions vs baseline
- [ ] ⛔ Critical controls (SOC2/ISO27001) — all green
- [ ] ⛔ Docs date integrity — no stale compliance dates
- [ ] ⛔ Architecture doc / runtime drift — 0 drift

---

## Phase 3 — Release build

Enforced by `release.yml`.

- [ ] ⛔ Reproducibility — two independent builds produce identical digests
- [ ] ⛔ Trivy scan (backend image) — 0 critical CVEs, 0 high CVEs
- [ ] ⛔ Trivy scan (frontend image) — 0 critical CVEs, 0 high CVEs
- [ ] ⛔ E2E tests (Playwright) — 0 failures across all test files
- [ ] ⛔ Cosign image signing — both images signed with OIDC identity
- [ ] ⛔ SBOM generated — `backend-sbom.spdx.json` and `frontend-sbom.spdx.json` uploaded
- [ ] ⛔ Release manifest emitted — `release-manifest.json` contains image refs + digests + gate results

---

## Phase 4 — Staging deploy + validation

Triggered automatically on push to `main` via `deploy.yml` (staging target).

- [ ] ⛔ Release manifest gate — manifest exists for this SHA
- [ ] ⛔ Supply-chain verification — Cosign signatures verify against OIDC issuer
- [ ] ⛔ DAST gate (OWASP ZAP vs staging) — 0 high findings, ≤ 5 medium findings
- [ ] ⛔ Reliability indicators gate — SLO burn rate, error rate, latency within bounds
- [ ] ⛔ Secret rotation evidence — all secrets rotated within policy window
- [ ] ⛔ Pre-deploy snapshot — PITR snapshot taken and ID recorded
- [ ] ⛔ Migration apply — forward migrations applied without error
- [ ] ⛔ Post-migration RLS check — all tenant-scoped tables still have RLS enabled
- [ ] ⛔ Blue/green slot swap — idle slot scaled up, smoke tests pass, traffic swapped
- [ ] ⛔ Post-swap smoke tests — /health/live, /health/ready, critical API paths all 200
- [ ] ⛔ Error rate — < 1% over 2-minute window post-swap
- [ ] ⛔ p95 latency — < 5000ms post-swap
- [ ] Staging soak — minimum 30 minutes of live traffic before production approval

---

## Phase 5 — Production readiness (human review)

These are manual checks performed by the release owner before requesting production approval.

- [ ] ⛔ No open P0 or P1 incidents
- [ ] ⛔ Previous rollback post-mortem closed (if applicable)
- [ ] ⛔ Staging soak complete (≥ 30 min, no anomalies in Prometheus/Grafana)
- [ ] ⛔ On-call engineer confirmed available for deploy window
- [ ] ⛔ Rollback plan reviewed — migration rollback SQL tested in staging
- [ ] ⛔ Backup verified — pre-deploy snapshot ID confirmed in deploy audit artifact
- [ ] ⛔ Change window approved (if organization requires change management)
- [ ] ⛔ Localization regressions triaged — no unresolved shipped-locale (`en`, `es`) regressions without owner and due date
- [ ] ⛔ Localization escalation complete (if needed) — unresolved regressions approved by `@team/owners` with a time-bound exception
- [ ] All release notes written and linked to GitHub Release
- [ ] Customer-facing changes communicated (if applicable)
- [ ] Feature flags set correctly for production

---

## Phase 6 — Production deploy

Triggered manually via `deploy.yml` `workflow_dispatch` with `environment: production`.

- [ ] ⛔ GitHub environment protection rule — required reviewers approved
- [ ] ⛔ All Phase 1–4 gates confirmed green in `release-gate-contract` job
- [ ] ⛔ Pre-deploy snapshot taken (production database)
- [ ] ⛔ Migration apply — forward migrations applied to production database
- [ ] ⛔ Idle slot scaled up with new image
- [ ] ⛔ Smoke tests against idle slot — all pass
- [ ] ⛔ Traffic swap executed
- [ ] ⛔ Post-swap smoke tests — all pass
- [ ] ⛔ Error rate < 1% over 5-minute window
- [ ] ⛔ p95 latency < 5000ms over 5-minute window
- [ ] ⛔ Old slot scaled down (kept at replicas: 0 for 24h)
- [ ] ⛔ Deploy audit artifact uploaded

---

## Phase 7 — Post-deploy monitoring (24h)

- [ ] Monitor error rate in Grafana (alert threshold: > 1%)
- [ ] Monitor p95 latency (alert threshold: > 5000ms)
- [ ] Monitor agent execution success rate (alert threshold: < 95%)
- [ ] Monitor LLM cost per request (alert threshold: > 2× baseline)
- [ ] Monitor queue depth (BullMQ) — no sustained backlog
- [ ] Verify no new Sentry errors introduced
- [ ] Confirm old slot still at replicas: 0 (available for instant rollback)
- [ ] After 24h: confirm old slot can be decommissioned

---

## Emergency rollback trigger criteria

Initiate rollback immediately if any of the following occur post-deploy:

- Error rate > 5% sustained for > 2 minutes
- p99 latency > 10,000ms sustained for > 2 minutes
- Any 5xx on `/api/auth/*` or `/api/tenants/*`
- Agent fabric producing outputs with confidence < block threshold (GovernanceVetoError spike)
- Any cross-tenant data access detected in audit logs
- On-call engineer judgment call

Rollback procedure: `docs/cicd/DEPLOYMENT_STRATEGY.md` → Rollback procedure section.
