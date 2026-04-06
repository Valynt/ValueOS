# ValueOS — Final Launch Sprint Plan

**Generated:** April 6, 2026
**Audit Basis:** Full-stack codebase audit (backend, frontend, infra, agents, tests, security)
**Sprint Duration:** 2 weeks each
**Format:** Jira/Linear–ready task breakdowns

---

## Executive Summary

ValueOS is **85–90% launch-ready**. The platform has comprehensive frontend views (30+ routes, all implemented), a mature agent fabric (11 agents, secureInvoke + hallucination detection), 100+ RLS policies, 987 test files, and production-grade infrastructure manifests. The critical path to launch consists of:

1. **6 runtime-crashing files** using a broken Supabase proxy (immediate fix)
2. **12 files** on a deprecated client factory (migration needed)
3. **Kubernetes manifests** still in "Aspirational" status (need staging validation)
4. **Alerting rules** not populated (Prometheus alert directory empty)
5. **Test coverage gates** missing for backend package

---

## Sprint 1 — Critical Blockers & Runtime Safety (Weeks 1–2)

> **Goal:** Eliminate all known runtime crashes, complete deprecated code migration, and establish missing CI gates.

### S1-01: Fix Broken `supabase` Proxy Usage (6 files)

| Field                   | Value                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Title**               | Fix broken `supabase` proxy imports (runtime crash)                                                                                                                                                                                                                                                                                        |
| **Description**         | 6 files import the deprecated `supabase` proxy from `../lib/supabase.js`, which throws at runtime: _"supabase export is deprecated and blocked."_ Replace each with the appropriate client factory: `createWorkerServiceSupabaseClient()` for workers, `getRequestSupabaseClient(req)` for request paths, or constructor-injected clients. |
| **Owner**               | Backend                                                                                                                                                                                                                                                                                                                                    |
| **Effort**              | S (2–4 hours)                                                                                                                                                                                                                                                                                                                              |
| **Dependencies**        | None                                                                                                                                                                                                                                                                                                                                       |
| **Acceptance Criteria** | (1) Zero imports of the bare `supabase` proxy remain. (2) `grep -r "from.*lib/supabase" packages/backend/src --include="*.ts" \| grep -v "supabase/"` returns 0 results. (3) Each migrated file has a passing unit test. (4) CI lint script `scripts/ci/tenant-isolation-lint.sh` passes.                                                  |

**Files:**

- `packages/backend/src/workers/AlertingRulesWorker.ts` (L5)
- `packages/backend/src/runtime/execution-runtime/adapters/WorkflowFailureSupabaseAdapter.ts` (L1)
- `packages/backend/src/observability/dataVolume.test.ts` (L15) — test mock
- `packages/backend/src/observability/dataFreshness.test.ts` (L12) — test mock

---

### S1-02: Migrate `createServerSupabaseClient` (12 files)

| Field                   | Value                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Replace all `createServerSupabaseClient` with privileged factories                                                                                                                                                                                                                                                                                          |
| **Description**         | 12 files still import the deprecated `createServerSupabaseClient`. Migrate each to the correct replacement: `createWorkerServiceSupabaseClient("justification")` for workers/cron, `createCronSupabaseClient()` for scheduled jobs, or `getRequestSupabaseClient(req)` for HTTP handlers. Each must include a `// service-role:justified <reason>` comment. |
| **Owner**               | Backend                                                                                                                                                                                                                                                                                                                                                     |
| **Effort**              | M (1–2 days)                                                                                                                                                                                                                                                                                                                                                |
| **Dependencies**        | S1-01                                                                                                                                                                                                                                                                                                                                                       |
| **Acceptance Criteria** | (1) `grep -r "createServerSupabaseClient" packages/backend/src` returns 0. (2) Every replacement includes justification comment. (3) Tenant isolation lint passes. (4) All affected tests pass.                                                                                                                                                             |

**Files:**

- `packages/backend/src/analytics/ValueLoopAnalytics.ts`
- `packages/backend/src/config/progressiveRollout.ts`
- `packages/backend/src/config/secretsManager.ts`
- `packages/backend/src/workers/CertificateGenerationWorker.ts`
- `packages/backend/src/workers/billingAggregatorWorker.ts`
- `packages/backend/src/workers/ArtifactGenerationWorker.ts`
- `packages/backend/src/lib/memory/SupabaseVectorStore.ts`
- `packages/backend/src/lib/memory/SupabaseSemanticStore.ts`
- `packages/backend/src/observability/dataVolume.ts`
- `packages/backend/src/observability/dataFreshness.ts`
- `packages/backend/src/runtime/approval-inbox/index.ts`
- `packages/backend/src/runtime/execution-runtime/index.ts`

---

### S1-03: Populate Prometheus Alerting Rules

| Field                   | Value                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Create Prometheus alert rules for SLO enforcement                                                                                                                                                                                                                                                                                            |
| **Description**         | The `infra/observability/prometheus/alerts/` directory is empty. Create alerting rules aligned with the SLOs in `infra/observability/SLOs.md`: availability ≥99.9%, latency p95 ≤300ms, MTTR ≤15min. Configure Alertmanager routing to Slack/PagerDuty.                                                                                      |
| **Owner**               | DevOps                                                                                                                                                                                                                                                                                                                                       |
| **Effort**              | M (1–2 days)                                                                                                                                                                                                                                                                                                                                 |
| **Dependencies**        | None                                                                                                                                                                                                                                                                                                                                         |
| **Acceptance Criteria** | (1) At least 5 alert rules created: high error rate, latency SLO breach, pod crash loop, Redis down, readiness probe failure. (2) Each alert has `runbook_url` annotation pointing to `docs/runbooks/`. (3) Alertmanager routing configured with at least one receiver (Slack webhook). (4) `promtool check rules` passes on all rule files. |

---

### S1-04: Add Backend Test Coverage Gates

| Field                   | Value                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Establish backend coverage thresholds in CI                                                                                                                                                                                                 |
| **Description**         | `packages/backend` has no coverage configuration or CI enforcement. Add vitest coverage config with `v8` provider, set thresholds (branches: 80%, functions: 80%, lines: 80%, statements: 80%), and add a CI step that fails on regression. |
| **Owner**               | QA                                                                                                                                                                                                                                          |
| **Effort**              | S (2–4 hours)                                                                                                                                                                                                                               |
| **Dependencies**        | None                                                                                                                                                                                                                                        |
| **Acceptance Criteria** | (1) `packages/backend/vitest.config.ts` has coverage thresholds defined. (2) `pnpm test --coverage` in backend package reports coverage %. (3) CI pipeline fails if coverage drops below thresholds.                                        |

---

### S1-05: Add Missing Worker Tests (5 workers)

| Field                   | Value                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Add tests for untested BullMQ workers                                                                                                                                                                                                                                                                                                                          |
| **Description**         | 5 workers lack dedicated test coverage: `WebhookRetryWorker`, `researchWorker`, `mcpIntegrationWorker`, `CertificateGenerationWorker`, `AlertingRulesWorker`. Each test must verify: (1) job processing succeeds for valid input, (2) tenant isolation (organizationId scoping), (3) error handling (job failure doesn't crash worker), (4) graceful shutdown. |
| **Owner**               | Backend                                                                                                                                                                                                                                                                                                                                                        |
| **Effort**              | M (2–3 days)                                                                                                                                                                                                                                                                                                                                                   |
| **Dependencies**        | S1-01 (AlertingRulesWorker fix)                                                                                                                                                                                                                                                                                                                                |
| **Acceptance Criteria** | (1) Each worker has ≥1 test file with ≥3 test cases. (2) All tests pass in CI. (3) Coverage for workers directory ≥80%.                                                                                                                                                                                                                                        |

---

### S1-06: Deploy to Staging & Validate K8s Manifests

| Field                   | Value                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Execute first staging deployment; validate manifest maturity                                                                                                                                                                                                                                                                                                                                            |
| **Description**         | All K8s manifests in `infra/k8s/` are marked "Aspirational" in `manifest-maturity-ledger.json`. Deploy the full stack to a staging cluster: backend (blue-green), frontend (nginx), Redis Sentinel, ingress (ALB). Validate health probes, auto-scaling thresholds, network policies, and ExternalSecrets operator connectivity. Update the maturity ledger from "Aspirational" to "Staging-Validated". |
| **Owner**               | DevOps                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Effort**              | L (3–5 days)                                                                                                                                                                                                                                                                                                                                                                                            |
| **Dependencies**        | S1-01, S1-02                                                                                                                                                                                                                                                                                                                                                                                            |
| **Acceptance Criteria** | (1) `/health`, `/ready`, `/healthz` return 200 on staging. (2) Blue-green toggle works (backend switch). (3) HPA scales from 2→4 pods under synthetic load. (4) Network policies block cross-namespace traffic. (5) ExternalSecrets injects secrets from AWS Secrets Manager. (6) `manifest-maturity-ledger.json` updated with staging evidence dates.                                                  |

---

### S1-07: Document PITR & Backup SLA

| Field                   | Value                                                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Publish database backup and PITR recovery policy                                                                                                                                                                                                                              |
| **Description**         | Backup retention and PITR window are undocumented. Add to `infra/README.md`: AWS RDS backup retention (30 days staging, 90 days production), PITR window (35 days), automated restore test frequency (weekly via DR workflow). Verify Terraform modules apply these settings. |
| **Owner**               | DevOps                                                                                                                                                                                                                                                                        |
| **Effort**              | S (2–4 hours)                                                                                                                                                                                                                                                                 |
| **Dependencies**        | None                                                                                                                                                                                                                                                                          |
| **Acceptance Criteria** | (1) `infra/README.md` has "Backup & Recovery" section with explicit retention numbers. (2) Terraform `aws_db_instance` resource has `backup_retention_period` set. (3) DR workflow (`dr-validation.yml`) includes restore test step.                                          |

---

### S1-08: Frontend Pre-Launch Validation

| Field                   | Value                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Validate ValyntApp TS error baseline + production build                                                                                                                                                                                                                                                 |
| **Description**         | ValyntApp has 4,239 TS errors (baselined 2026-03-26) under a ratchet policy. Verify the count hasn't grown. Run production build to confirm bundle budget (max 2000KB/chunk, 5000KB initial JS) passes. Validate no hardcoded secrets in frontend code. Run Axe accessibility scan on 5 critical paths. |
| **Owner**               | Frontend                                                                                                                                                                                                                                                                                                |
| **Effort**              | S (3–4 hours)                                                                                                                                                                                                                                                                                           |
| **Dependencies**        | None                                                                                                                                                                                                                                                                                                    |
| **Acceptance Criteria** | (1) `tsc --noEmit` error count ≤ 4,239 for ValyntApp. (2) `pnpm build` succeeds without budget violations. (3) `grep -r "sk_live\|service_role" apps/ValyntApp/src` returns 0. (4) Axe scan on login, dashboard, deal-assembly, value-model, billing — 0 critical violations.                           |

---

## Sprint 2 — Stabilization & Production Hardening (Weeks 3–4)

> **Goal:** Load test, chaos test, harden monitoring, fill security gaps, and achieve "Production-Validated" status on all infrastructure.

### S2-01: 24-Hour Staging Load Test

| Field                   | Value                                                                                                                                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Execute 24-hour load test against staging                                                                                                                                                                                                                                                                |
| **Description**         | Run synthetic user journeys against the staging cluster for 24 hours. Validate SLOs: availability ≥99.9%, p95 latency ≤300ms, p99 ≤10s. Use k6 or Artillery. Load profile: 100 concurrent users (baseline), ramping to 500 (peak). Cover: auth flow, deal assembly, agent invocation, dashboard queries. |
| **Owner**               | QA + DevOps                                                                                                                                                                                                                                                                                              |
| **Effort**              | L (3–5 days including setup + analysis)                                                                                                                                                                                                                                                                  |
| **Dependencies**        | S1-06 (staging deployed)                                                                                                                                                                                                                                                                                 |
| **Acceptance Criteria** | (1) 24-hour run completes without crashes. (2) p95 latency ≤300ms confirmed. (3) p99 ≤10s confirmed. (4) Error rate <0.1%. (5) No memory leaks (heap ≤1GB). (6) Results documented in `docs/load-test-results/`.                                                                                         |

---

### S2-02: Rollback Rehearsal (Blue-Green)

| Field                   | Value                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Execute and document rollback procedure                                                                                                                                                                                                                                                                 |
| **Description**         | Deploy a known-broken version (e.g., a canary with /health returning 503) to the blue slot. Verify active traffic stays on green. Toggle to blue (observe failure), then roll back to green. Time the entire procedure. Target: rollback ≤2 minutes. Document as `docs/runbooks/rollback-procedure.md`. |
| **Owner**               | DevOps                                                                                                                                                                                                                                                                                                  |
| **Effort**              | M (1 day)                                                                                                                                                                                                                                                                                               |
| **Dependencies**        | S1-06                                                                                                                                                                                                                                                                                                   |
| **Acceptance Criteria** | (1) Rollback completes in ≤2 minutes. (2) No user-facing errors during rollback. (3) Runbook written with exact commands and verification steps.                                                                                                                                                        |

---

### S2-03: Chaos Testing in CI

| Field                   | Value                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Title**               | Promote key chaos tests to CI required checks                                                                                                                                                                                                                      |
| **Description**         | 6 chaos suites exist in `tests/chaos/` but aren't in the critical path. Promote at least 3 to required CI checks: (1) database outage recovery, (2) Redis disconnection handling, (3) LLM provider timeout/fallback. Verify workers and agents degrade gracefully. |
| **Owner**               | QA + Backend                                                                                                                                                                                                                                                       |
| **Effort**              | M (1–2 days)                                                                                                                                                                                                                                                       |
| **Dependencies**        | S1-05 (worker tests)                                                                                                                                                                                                                                               |
| **Acceptance Criteria** | (1) 3 chaos tests run in PR pipeline. (2) Tests verify graceful degradation (not crashes). (3) DLQ captures failed jobs during Redis outage. (4) Agent secureInvoke circuit breaker triggers on LLM timeout.                                                       |

---

### S2-04: Add Semgrep SAST Rules

| Field                   | Value                                                                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Add Semgrep configuration for injection/auth/crypto patterns                                                                                                                                                                                                    |
| **Description**         | CodeQL is in place but Semgrep (referenced in CI control matrix) has no config. Create `.semgrep.yml` with rules for: SQL injection, XSS, command injection, insecure crypto, hardcoded secrets, missing auth checks. Add to `pr-fast.yml` as a blocking check. |
| **Owner**               | Security                                                                                                                                                                                                                                                        |
| **Effort**              | M (1 day)                                                                                                                                                                                                                                                       |
| **Dependencies**        | None                                                                                                                                                                                                                                                            |
| **Acceptance Criteria** | (1) `.semgrep.yml` exists with ≥10 rules. (2) `semgrep --config .semgrep.yml` runs clean on codebase. (3) Integrated into `pr-fast.yml` as blocking step. (4) No false positives on current code.                                                               |

---

### S2-05: SBOM Generation in Release Pipeline

| Field                   | Value                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Title**               | Generate CycloneDX SBOM on every release                                                                                                                                                               |
| **Description**         | No SBOM is generated in the release pipeline. Add `@cyclonedx/cyclonedx-npm` or Syft to `release.yml` to produce SBOM artifacts. Store alongside release assets. Required for supply-chain compliance. |
| **Owner**               | DevOps                                                                                                                                                                                                 |
| **Effort**              | S (3–4 hours)                                                                                                                                                                                          |
| **Dependencies**        | None                                                                                                                                                                                                   |
| **Acceptance Criteria** | (1) `release.yml` produces `sbom.json` (CycloneDX format). (2) SBOM uploaded as GitHub Release asset. (3) SBOM includes all production dependencies with versions.                                     |

---

### S2-06: Add Trivy Container Scanning

| Field                   | Value                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Add Trivy vulnerability scanning to CI/CD                                                                                                                                                                                                               |
| **Description**         | Trivy is referenced in the Dockerfile security-scan stage but not integrated into CI workflows. Add Trivy scanning to `pr-fast.yml` (filesystem mode for dependencies) and `release.yml` (container image mode). Fail on HIGH/CRITICAL vulnerabilities. |
| **Owner**               | DevOps + Security                                                                                                                                                                                                                                       |
| **Effort**              | S (3–4 hours)                                                                                                                                                                                                                                           |
| **Dependencies**        | None                                                                                                                                                                                                                                                    |
| **Acceptance Criteria** | (1) `trivy fs --severity HIGH,CRITICAL --exit-code 1 .` runs in PR pipeline. (2) `trivy image` scans production container in release pipeline. (3) Current codebase passes (0 HIGH/CRITICAL, or documented exceptions).                                 |

---

### S2-07: Create Runbooks for Alert Rules

| Field                   | Value                                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Write operational runbooks for each Prometheus alert                                                                                                                                                                                      |
| **Description**         | Each alert created in S1-03 needs a runbook in `docs/runbooks/`. Cover: symptom identification, diagnostic commands, escalation path, resolution steps, verification.                                                                     |
| **Owner**               | DevOps + Backend                                                                                                                                                                                                                          |
| **Effort**              | M (1–2 days)                                                                                                                                                                                                                              |
| **Dependencies**        | S1-03                                                                                                                                                                                                                                     |
| **Acceptance Criteria** | (1) Each alert has a matching `docs/runbooks/<alert-name>.md`. (2) Runbooks include: triage checklist, `kubectl`/query commands, escalation contacts, resolution verification. (3) Alert annotations `runbook_url` point to correct file. |

---

### S2-08: Harden Telemetry for Production

| Field                   | Value                                                                                                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Make telemetry non-optional in production                                                                                                                                                                                                                              |
| **Description**         | Telemetry is optionally loaded (`ENABLE_TELEMETRY !== "false"`). In production, telemetry should be mandatory — fail startup if OTEL collector is unreachable. Add a startup check in `server.ts` that verifies OTEL endpoint connectivity when `NODE_ENV=production`. |
| **Owner**               | Backend                                                                                                                                                                                                                                                                |
| **Effort**              | S (2–4 hours)                                                                                                                                                                                                                                                          |
| **Dependencies**        | S1-06 (staging OTEL collector)                                                                                                                                                                                                                                         |
| **Acceptance Criteria** | (1) In production mode, server exits with error if OTEL collector unreachable. (2) In dev/test, telemetry remains optional. (3) Health check includes OTEL status.                                                                                                     |

---

### S2-09: UI Polish — Loading States & Empty States

| Field                   | Value                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Standardize loading patterns + add missing empty states                                                                                                                                                                                                                                                                                                                                                        |
| **Description**         | Audit found: inconsistent loading patterns (skeleton vs spinner), missing empty state for Agents page, missing retry on HypothesisStage and ModelStage error states. Fix the 4 specific gaps: (1) Add empty state for Agents page. (2) Add retry button to HypothesisStage error. (3) Add retry button to ModelStage error. (4) Add `aria-label` to `<nav>` in Sidebar.tsx + `role="alert"` to error messages. |
| **Owner**               | Frontend                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Effort**              | M (1 day)                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Dependencies**        | None                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Acceptance Criteria** | (1) Agents page shows helpful empty state when no agents configured. (2) HypothesisStage and ModelStage show "Retry" button on error. (3) Sidebar `<nav>` has `aria-label="Main navigation"`. (4) Error toasts have `role="alert"`.                                                                                                                                                                            |

---

## Sprint 3 — Launch Validation & Go-Live (Weeks 5–6)

> **Goal:** Final security audit, production deployment, cutover, and post-launch monitoring setup.

### S3-01: Production Deployment Dry Run

| Field                   | Value                                                                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Execute production deployment (no traffic)                                                                                                                                                                                                                                                    |
| **Description**         | Deploy to production K8s cluster with zero traffic (green slot only). Validate: external secrets injection from AWS Secrets Manager, database connectivity (production Supabase), Redis Sentinel cluster, WAF rules, SSL/TLS (ACM certificate), CDN cache headers. Do NOT switch traffic yet. |
| **Owner**               | DevOps                                                                                                                                                                                                                                                                                        |
| **Effort**              | L (2–3 days)                                                                                                                                                                                                                                                                                  |
| **Dependencies**        | S2-01 (load test passed), S2-02 (rollback rehearsed)                                                                                                                                                                                                                                          |
| **Acceptance Criteria** | (1) All health endpoints return 200. (2) Secrets injected correctly (no hardcoded values). (3) Database migration state matches staging. (4) Redis Sentinel topology healthy. (5) WAF blocks test attack payloads. (6) HTTPS with valid cert.                                                 |

---

### S3-02: Production Smoke Tests

| Field                   | Value                                                                                                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Run production smoke test suite                                                                                                                                                                                                                                        |
| **Description**         | Execute a subset of E2E tests against the production deployment (green slot, internal traffic only). Test: signup + login, create organization, run agent (deal assembly), view dashboard, billing page loads. Do NOT use real payment methods — use Stripe test mode. |
| **Owner**               | QA                                                                                                                                                                                                                                                                     |
| **Effort**              | M (1 day)                                                                                                                                                                                                                                                              |
| **Dependencies**        | S3-01                                                                                                                                                                                                                                                                  |
| **Acceptance Criteria** | (1) All 6 critical user flows pass. (2) No 500 errors in server logs. (3) Latency within SLO bounds. (4) Tenant isolation verified (cross-org queries return empty).                                                                                                   |

---

### S3-03: Security Pen Test (Focused)

| Field                   | Value                                                                                                                                                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Focused penetration test on auth + tenant isolation                                                                                                                                                                                                                                                                  |
| **Description**         | Run targeted security testing: (1) JWT manipulation (expired, modified claims, cross-tenant). (2) IDOR on API routes (access other org's data). (3) CSRF bypass attempts. (4) Rate limit evasion on auth routes. (5) SQL injection on search/filter endpoints. Use existing test infrastructure + manual curl tests. |
| **Owner**               | Security                                                                                                                                                                                                                                                                                                             |
| **Effort**              | M (2 days)                                                                                                                                                                                                                                                                                                           |
| **Dependencies**        | S3-01                                                                                                                                                                                                                                                                                                                |
| **Acceptance Criteria** | (1) Zero CRITICAL or HIGH findings. (2) All MEDIUM findings documented with mitigation timeline. (3) Report stored in `docs/security-compliance/pen-test-<date>.md`.                                                                                                                                                 |

---

### S3-04: Final TS Error Ratchet Check

| Field                   | Value                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Verify TS error counts haven't regressed                                                                                                                             |
| **Description**         | Run `tsc --noEmit` across all packages and compare to baselines: ValyntApp ≤4,239, backend ≤29, SDUI ≤136. If any have grown, fix or re-baseline with justification. |
| **Owner**               | Frontend + Backend                                                                                                                                                   |
| **Effort**              | S (2–4 hours)                                                                                                                                                        |
| **Dependencies**        | None                                                                                                                                                                 |
| **Acceptance Criteria** | (1) All packages at or below baseline. (2) If re-baselined, justification documented in PR.                                                                          |

---

### S3-05: Secret Rotation Pre-Launch

| Field                   | Value                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Rotate all production secrets before go-live                                                                                                                                                                                                                                                                            |
| **Description**         | Rotate: Supabase service_role key, JWT secret, Stripe API keys, OpenAI/Together API keys, Redis password, session secret. Use AWS Secrets Manager for storage. Update ExternalSecrets references. Verify rotation didn't break health checks. Create rotation log at `docs/security-compliance/secret-rotation-log.md`. |
| **Owner**               | Security + DevOps                                                                                                                                                                                                                                                                                                       |
| **Effort**              | M (1 day)                                                                                                                                                                                                                                                                                                               |
| **Dependencies**        | S3-01 (production deployed)                                                                                                                                                                                                                                                                                             |
| **Acceptance Criteria** | (1) All secrets rotated (age < 24 hours). (2) Health checks pass post-rotation. (3) Rotation log committed. (4) `secret-rotation-verification.yml` passes.                                                                                                                                                              |

---

### S3-06: Traffic Cutover (Go-Live)

| Field                   | Value                                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**               | Switch production traffic to green slot                                                                                                                                                                                                                    |
| **Description**         | Execute the blue-green switch: update the active-service selector to point to the green deployment. Monitor error rates, latency, and health for 30 minutes. If any SLO is breached, execute immediate rollback per `docs/runbooks/rollback-procedure.md`. |
| **Owner**               | DevOps                                                                                                                                                                                                                                                     |
| **Effort**              | S (2–4 hours including monitoring window)                                                                                                                                                                                                                  |
| **Dependencies**        | S3-01, S3-02, S3-03, S3-05                                                                                                                                                                                                                                 |
| **Acceptance Criteria** | (1) Traffic flowing to production. (2) Error rate <0.1% for 30 minutes. (3) p95 latency ≤300ms. (4) All health endpoints 200. (5) No RLS violations in logs.                                                                                               |

---

## Production Readiness Checklist

| #   | Category             | Check                                                         | Status |
| --- | -------------------- | ------------------------------------------------------------- | ------ |
| 1   | **Runtime Safety**   | Zero imports of broken `supabase` proxy                       | ⬜     |
| 2   | **Runtime Safety**   | Zero imports of `createServerSupabaseClient`                  | ⬜     |
| 3   | **Runtime Safety**   | All workers start without error                               | ⬜     |
| 4   | **Tenant Isolation** | `tenant-isolation-lint.sh` passes                             | ⬜     |
| 5   | **Tenant Isolation** | `pnpm test:rls` passes (100+ RLS policies validated)          | ⬜     |
| 6   | **TypeScript**       | ValyntApp TS errors ≤ baseline (4,239)                        | ⬜     |
| 7   | **TypeScript**       | Backend TS errors ≤ baseline (29)                             | ⬜     |
| 8   | **Build**            | `pnpm build` succeeds (ValyntApp + backend)                   | ⬜     |
| 9   | **Build**            | Frontend bundle budget passes (≤2MB/chunk, ≤5MB initial)      | ⬜     |
| 10  | **Tests**            | Full test suite passes (`pnpm test`)                          | ⬜     |
| 11  | **Tests**            | E2E gate passes (`pnpm test:e2e:gate`)                        | ⬜     |
| 12  | **Tests**            | Backend coverage ≥80%                                         | ⬜     |
| 13  | **Security**         | Gitleaks full-history scan clean                              | ⬜     |
| 14  | **Security**         | CodeQL clean (0 CRITICAL/HIGH)                                | ⬜     |
| 15  | **Security**         | CSRF protection verified on auth routes                       | ⬜     |
| 16  | **Security**         | No hardcoded secrets in frontend code                         | ⬜     |
| 17  | **Security**         | All production secrets rotated (age < 7 days)                 | ⬜     |
| 18  | **Infrastructure**   | Health endpoints return 200 (`/health`, `/ready`, `/healthz`) | ⬜     |
| 19  | **Infrastructure**   | Blue-green deployment operational                             | ⬜     |
| 20  | **Infrastructure**   | HPA auto-scaling tested                                       | ⬜     |
| 21  | **Infrastructure**   | Redis Sentinel topology healthy                               | ⬜     |
| 22  | **Infrastructure**   | ExternalSecrets injecting from AWS Secrets Manager            | ⬜     |
| 23  | **Infrastructure**   | SSL/TLS cert valid + HSTS enabled                             | ⬜     |
| 24  | **Infrastructure**   | WAF rules active (production)                                 | ⬜     |
| 25  | **Observability**    | Prometheus scraping backend + Redis + Postgres                | ⬜     |
| 26  | **Observability**    | Alert rules deployed + tested (fire/resolve cycle)            | ⬜     |
| 27  | **Observability**    | Alertmanager routing to Slack/PagerDuty confirmed             | ⬜     |
| 28  | **Observability**    | Grafana dashboards accessible                                 | ⬜     |
| 29  | **Observability**    | OTEL traces flowing (Tempo)                                   | ⬜     |
| 30  | **Backup**           | RDS backup retention configured (≥30 days)                    | ⬜     |
| 31  | **Backup**           | DR validation workflow passes                                 | ⬜     |
| 32  | **Documentation**    | Rollback runbook written and rehearsed                        | ⬜     |
| 33  | **Documentation**    | PITR/backup SLA documented                                    | ⬜     |
| 34  | **Documentation**    | Runbooks for each alert rule                                  | ⬜     |
| 35  | **Load Test**        | 24-hour load test passed (SLO compliance)                     | ⬜     |

---

## Launch Day Runbook

### T-24h (Day Before)

1. **Freeze code.** No merges to `main` after 12:00 UTC.
2. **Rotate secrets.** Execute S3-05. Verify `secret-rotation-verification.yml` passes.
3. **Final smoke test.** Run E2E suite against production (green slot, no traffic).
4. **Team sync.** All owners confirm their checklist items are green.
5. **Communication.** Draft status page announcement: "Planned maintenance window."

### T-4h (Morning of Launch)

6. **Monitor baseline.** Capture current Prometheus metrics (error rate, latency, pod count).
7. **Verify readiness probes.** `curl https://app.valynt.com/ready` → 200.
8. **Verify rollback capability.** Confirm blue slot still has last-known-good image.
9. **Open war room.** All hands in Slack `#launch-ops` channel.

### T-0 (Cutover)

10. **Switch traffic.**
    ```bash
    kubectl patch service backend-active \
      -p '{"spec":{"selector":{"slot":"green"}}}' \
      --namespace production
    ```
11. **Start 30-minute monitoring window.**
    - Watch: error rate, p95/p99 latency, pod restarts, RLS violation logs
    - Dashboard: Grafana → ValueOS Production Overview
12. **If SLO breached → ROLLBACK:**
    ```bash
    kubectl patch service backend-active \
      -p '{"spec":{"selector":{"slot":"blue"}}}' \
      --namespace production
    ```
    Then diagnose and re-attempt after fix.

### T+30m (Post-Cutover Validation)

13. **Confirm SLOs held** for 30 minutes.
14. **Run production smoke tests** (auth, dashboard, agent invoke, billing page).
15. **Check logs.** `kubectl logs -l app=backend --tail=500 | grep -i error | head -20`
16. **Announce launch.** Update status page: "ValueOS is live."

### T+4h (Afternoon Check)

17. **Review error rate trend.** Should be flat or declining.
18. **Check Redis.** `redis-cli -h redis-broker-primary info replication`
19. **Check DLQ.** Verify no jobs in dead letter queue.
20. **Check worker health.** All 10 BullMQ workers processing.

---

## First 7 Days Post-Launch Monitoring Plan

### Day 1 — Hypercare

| Time         | Action                                                                   | Owner   |
| ------------ | ------------------------------------------------------------------------ | ------- |
| Every 30 min | Check error rate dashboard                                               | On-call |
| Every 1h     | Review Slack `#launch-ops` for alerts                                    | DevOps  |
| Every 2h     | Check DLQ depth                                                          | Backend |
| Every 4h     | Review pod restart count                                                 | DevOps  |
| End of day   | Publish Day 1 report: error rate, latency p95/p99, user count, incidents | DevOps  |

**Escalation thresholds (Day 1):**

- Error rate >0.5% → Page DevOps + Backend lead
- p99 latency >5s → Page Backend lead
- Any RLS violation → Page Security + Backend lead immediately
- Pod CrashLoopBackOff → Page DevOps immediately

### Day 2–3 — Active Monitoring

| Metric           | Check Frequency | Threshold                   |
| ---------------- | --------------- | --------------------------- |
| Error rate       | Every 2h        | <0.1%                       |
| p95 latency      | Every 2h        | ≤300ms                      |
| p99 latency      | Every 4h        | ≤10s                        |
| DLQ depth        | Every 4h        | 0 (investigate any entries) |
| Pod restarts     | Every 4h        | 0 since last check          |
| Disk usage (RDS) | Daily           | <70%                        |
| Redis memory     | Daily           | <80% maxmemory              |
| Heap usage       | Daily           | <800MB average              |

**Actions:**

- Triage any P0/P1 alerts immediately
- Begin async investigation of P2 issues
- Daily standup at 09:00 UTC focused on production health

### Day 4–5 — Stabilization

| Action                                               | Owner   |
| ---------------------------------------------------- | ------- |
| Analyze error log patterns — categorize by type      | Backend |
| Review slow query report (Supabase)                  | Backend |
| Verify coverage of real user paths vs E2E coverage   | QA      |
| Evaluate auto-scaling behavior (HPA history)         | DevOps  |
| Check OTEL trace volume — optimize sampling if noisy | DevOps  |

**Reduce check frequency to every 4 hours** if no incidents in 48h.

### Day 6–7 — Confidence Building

| Action                                                           | Owner  |
| ---------------------------------------------------------------- | ------ |
| Publish "Week 1 Launch Report"                                   | DevOps |
| Conduct mini-retro (launch process, incident log, improvements)  | All    |
| Move to standard on-call rotation (exit hypercare)               | DevOps |
| Update `manifest-maturity-ledger.json` to "Production-Validated" | DevOps |
| Schedule first production DR validation run                      | DevOps |
| Plan Sprint 4 based on production learnings                      | Team   |

---

## Top 5 Risks + Mitigation Strategies

### Risk 1: Tenant Data Leakage via Deprecated Client Factories

| Field           | Detail                                                                                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Probability** | Medium                                                                                                                                                                                                   |
| **Impact**      | Critical (data breach, regulatory exposure)                                                                                                                                                              |
| **Description** | 12 files still use `createServerSupabaseClient` which doesn't enforce tenant scoping. 6 files use a broken proxy that crashes. If new code accidentally uses these patterns, tenant data could leak.     |
| **Mitigation**  | (1) S1-01 and S1-02 eliminate all deprecated usage. (2) CI lint script blocks future regressions. (3) ESLint `no-restricted-imports` rule for banned factories. (4) Nightly governance scan re-verifies. |
| **Contingency** | If discovered post-launch: immediately revert to service-role audit allowlist, block affected routes, rotate affected tenant credentials.                                                                |

### Risk 2: Kubernetes Manifest Immaturity

| Field           | Detail                                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Probability** | High                                                                                                                                                                                                  |
| **Impact**      | High (outage, failed deployment, unable to scale)                                                                                                                                                     |
| **Description** | All K8s manifests are "Aspirational" — never tested on a real cluster. Resource limits, HPA thresholds, network policies, and ExternalSecrets config may have errors that only surface in production. |
| **Mitigation**  | (1) S1-06 deploys to staging and validates each manifest. (2) S2-01 load tests for 24 hours. (3) S2-02 rehearses rollback. (4) Maturity ledger tracks validation evidence.                            |
| **Contingency** | If staging deployment fails: fall back to Docker Compose on a single VM (emergency mode) while fixing K8s issues.                                                                                     |

### Risk 3: Missing Alerting = Blind Spot in Production

| Field           | Detail                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Probability** | High (alert rules directory is currently empty)                                                                                                                   |
| **Impact**      | High (undetected outages, SLO breaches without notification)                                                                                                      |
| **Description** | Prometheus is configured but has no alert rules. Alertmanager routing is commented out. Without alerts, the team won't know about issues until users report them. |
| **Mitigation**  | (1) S1-03 populates alert rules. (2) S2-07 creates runbooks. (3) Fire/resolve test cycle confirms routing before launch.                                          |
| **Contingency** | Day 1 hypercare with manual dashboard monitoring every 30 minutes until alerting is confirmed operational.                                                        |

### Risk 4: Load Performance Under Real Traffic Patterns

| Field           | Detail                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Probability** | Medium                                                                                                                                                                                                                                                        |
| **Impact**      | Medium-High (degraded UX, user churn, agent timeouts)                                                                                                                                                                                                         |
| **Description** | Agent invocations involve LLM calls (5–30s latency each). Under concurrent load, BullMQ queue depth could grow, database connections pool could exhaust, and memory leaks could emerge over time. Real traffic patterns may differ from synthetic load tests. |
| **Mitigation**  | (1) S2-01 runs 24-hour load test with agent invocations. (2) Rate limiting tiers (STRICT for agents) already in place. (3) Circuit breaker in `secureInvoke` limits cascading failures. (4) HPA scales under load.                                            |
| **Contingency** | If p99 exceeds SLO: increase pod count (HPA manual override), enable agent request queue with backpressure (return 429), scale LLM provider tier.                                                                                                             |

### Risk 5: Supply Chain or Dependency Vulnerability

| Field           | Detail                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Probability** | Low-Medium                                                                                                                                                                           |
| **Impact**      | High (compromised build, RCE, data exfiltration)                                                                                                                                     |
| **Description** | No Trivy container scanning in CI. No SBOM in release pipeline. Renovate handles patches but a compromised dependency could ship undetected.                                         |
| **Mitigation**  | (1) S2-05 adds SBOM generation. (2) S2-06 adds Trivy scanning. (3) Gitleaks already scans for secrets in dependencies. (4) Reproducible build verification detects binary tampering. |
| **Contingency** | If vulnerability discovered post-launch: patch and redeploy (≤4h SLA). Use `pnpm audit` to identify scope. WAF and network policies limit blast radius.                              |

---

## Sprint Summary View

```
 Sprint 1 (Weeks 1-2): CRITICAL BLOCKERS
 ┌──────────────────────────────────────────────────┐
 │ S1-01  Fix broken proxy (6 files)         [S] BE │
 │ S1-02  Migrate deprecated factory (12)    [M] BE │
 │ S1-03  Prometheus alert rules             [M] DO │
 │ S1-04  Backend test coverage gates        [S] QA │
 │ S1-05  Worker tests (5 workers)           [M] BE │
 │ S1-06  Staging deployment + K8s validate  [L] DO │
 │ S1-07  PITR & backup SLA docs            [S] DO │
 │ S1-08  Frontend TS + build validation     [S] FE │
 └──────────────────────────────────────────────────┘

 Sprint 2 (Weeks 3-4): STABILIZATION & HARDENING
 ┌──────────────────────────────────────────────────┐
 │ S2-01  24-hour load test                  [L] QA │
 │ S2-02  Rollback rehearsal                 [M] DO │
 │ S2-03  Chaos tests in CI                  [M] QA │
 │ S2-04  Semgrep SAST rules                [M] SE │
 │ S2-05  SBOM in release pipeline           [S] DO │
 │ S2-06  Trivy container scanning           [S] DO │
 │ S2-07  Alert runbooks                     [M] DO │
 │ S2-08  Harden telemetry for prod          [S] BE │
 │ S2-09  UI polish (empty/error states)     [M] FE │
 └──────────────────────────────────────────────────┘

 Sprint 3 (Weeks 5-6): LAUNCH VALIDATION & GO-LIVE
 ┌──────────────────────────────────────────────────┐
 │ S3-01  Production deployment (dry run)    [L] DO │
 │ S3-02  Production smoke tests             [M] QA │
 │ S3-03  Focused pen test                   [M] SE │
 │ S3-04  Final TS error ratchet check       [S] FE │
 │ S3-05  Secret rotation pre-launch         [M] SE │
 │ S3-06  Traffic cutover (GO-LIVE)          [S] DO │
 └──────────────────────────────────────────────────┘

 Legend: [S]=Small(≤4h) [M]=Medium(1-2d) [L]=Large(3-5d)
         BE=Backend  FE=Frontend  DO=DevOps  QA=QA  SE=Security
```

---

## Dependency Graph

```
S1-01 ──┬── S1-02 ──┬── S1-06 ──── S2-01 ──── S3-01 ──── S3-06
        │           │              S2-02 ──┘            │
        │           └──────────────────────────── S3-02 ┘
        └── S1-05 ──── S2-03
S1-03 ──── S2-07
S1-04
S1-07
S1-08 ──── S3-04
S2-04
S2-05
S2-06
S2-08
S2-09
                              S3-03 ──── S3-05 ──── S3-06
```

**Critical Path:** S1-01 → S1-02 → S1-06 → S2-01 → S3-01 → S3-06 (Go-Live)

---

_This plan is structured, actionable, and ready to paste into Jira/Linear. Each task has a unique ID (S[sprint]-[seq]), owner designation, effort estimate, dependencies, and acceptance criteria._
