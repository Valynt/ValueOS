# Production Readiness: Gap Closure & Evidence Spec

**Status:** Draft  
**Priority stack:** Tenancy/RLS → Security → Testing/CI → Performance → Frontend/a11y  
**Scope:** Technical controls only. Compliance framework mapping (SOC2/ISO/GDPR) is excluded.

---

## Problem Statement

ValueOS is a multi-tenant, CFO-defensible value intelligence platform. Production readiness requires that every control is both **implemented** and **provably enforced**. A control that exists in code but lacks CI-gated evidence is not production-ready — it is an assertion, not a proof.

This spec closes the loop between implementation and trust by:
1. Identifying gaps (missing, broken, or unverified controls)
2. Defining remediation with concrete acceptance criteria
3. Requiring evidence artifacts for every control (test output, CI gate, runtime validation, or audit log)

The output feeds directly into CI promotion gates, the Trust Portal, and the IntegrityAgent / ComplianceAuditorAgent validation layer.

---

## Current State Summary

### What exists and is working

| Domain | Existing coverage |
|---|---|
| Secret scanning | Gitleaks on every PR diff + full-history scan on `main`; `.gitleaks.toml` with custom rules |
| Input validation | `InputSanitizer`, `inputValidation.ts` middleware with XSS/path-traversal/prompt-injection patterns; Zod schemas throughout |
| AuthZ middleware | `rbac.ts` with `requirePermission`, `requireRole`, `requirePolicy` (ABAC); deny-by-default on missing auth |
| SSRF guards | `WebScraperService` with `NetworkSegmentation.ts`; SSRF test suite at `packages/backend/src/services/__tests__/WebScraperSSRF.test.ts` |
| Tenant context | `tenantContext.ts` with `AsyncLocalStorage`; TCT JWT; `organization_id` / `tenant_id` required on all queries (enforced in `AGENTS.md`) |
| Rate limiting | Tiered Redis-backed rate limiter (strict/standard/loose/auth); fail-closed for auth and admin mutations |
| RBAC/ABAC | System roles + custom tenant roles via `membership_roles`; audit hooks on all mutations |
| RLS test suite | `tests/security/rls-tenant-isolation.test.ts` + 5 other RLS test files; nightly gate asserts ≥10 passing |
| SBOM | CycloneDX + SPDX generated on release; cosign image signing + blob signing |
| IaC scanning | Checkov on Terraform in `terraform.yml`; custom policies in `.checkov/` |
| Dependency scanning | `pnpm audit --audit-level=high` in `security-gate` lane |
| Container scanning | Trivy fs + image scan; HIGH/CRITICAL fail `security-gate` |
| SLOs | Defined in `docs/operations/slo-sli.md`; Prometheus recording rules + burn-rate alerts in `infra/k8s/monitoring/` |
| Performance budgets | p95/p99 thresholds in `scripts/performance/benchmark-config.ts`; route load budgets in `.github/metrics/ux-performance-budgets.json` |
| BullMQ workers | `ArtifactGenerationWorker`, `CertificateGenerationWorker`, `crmWorker`, `researchWorker`, `billingAggregatorWorker` |
| A11y | `SkipLink`, `useFocusTrap`, `useAnnouncer` in `utils/accessibility.tsx`; axe-core Playwright tests; WCAG 2.2 AA nightly run |
| Error boundaries | `ErrorBoundary.tsx` present; `Suspense` + skeleton patterns in key pages |
| Contract tests | `versioning.contract.test.ts`, `AuditLogService.contract.test.ts`, `CommunicationEvent.contract.test.ts`, `mcpDiscovery.contract.test.ts` |
| CI security gate | `security-gate` lane in `pr-fast.yml` and `main-verify.yml` covering Semgrep, Gitleaks, Trivy, pnpm audit |

### Confirmed gaps

| # | Domain | Gap | Blast radius |
|---|---|---|---|
| G-01 | Security | Real Supabase project keys (`wfhdrrpijqygytvoaafc`, `bxaiabnqalurloblfwua`) in git history — rotation **PENDING** | Critical |
| G-02 | Security | KMS rotation policy not documented as a machine-readable artifact with owner, frequency, and propagation path | High |
| G-03 | Security | No automated rotation workflow — rotation log exists but is manual | High |
| G-04 | Tenancy | Redis cache key namespacing per tenant not verified by a CI-enforced test | High |
| G-05 | Tenancy | Vector memory tenant isolation tests are nightly-only; no PR gate | Medium |
| G-06 | Tenancy | No explicit test asserting BullMQ job payloads cannot read cross-tenant data | Medium |
| G-07 | Security | No systematic audit of which resource endpoints use `requireOwnership` vs. rely solely on RLS | Medium |
| G-08 | Testing/CI | No flake tracking infrastructure — flake rate is unmeasured; no threshold enforcement | High |
| G-09 | Testing/CI | A11y smoke (axe) runs only nightly; regressions can merge undetected | Medium |
| G-10 | Testing/CI | Performance smoke (route load budgets) runs only nightly; no PR-level perf gate | Medium |
| G-11 | Performance | No CI gate verifying Prometheus alert/recording rules are syntactically valid | Medium |
| G-12 | Performance | No systematic audit of hot endpoints for N+1 queries | Medium |
| G-13 | Frontend/a11y | `SkipLink` component exists but no CI assertion it is rendered in `MainLayout` | Low |
| G-14 | Security | No CI check that dev-only routes/middleware are disabled in production builds | Low |

---

## Requirements

### Domain 1: Tenancy / RLS (P0)

**REQ-T1** — The nightly RLS test count gate (≥10 passing) must be promoted to a PR-blocking check in `pr-fast.yml`. The nightly run continues for deeper coverage.

**REQ-T2** — Redis cache keys must be namespaced per tenant. A unit test must assert that `buildLLMCacheKey` (and any other cache key builder) throws when `tenantId` is absent and produces a key prefixed with the tenant ID when present. This test must run in the `pr-fast` lane.

**REQ-T3** — BullMQ workers must call `tenantContextStorage.run()` before processing any job. An integration test must verify that a worker cannot read data belonging to a different tenant within the same queue. This test must run in `pr-fast`.

**REQ-T4** — Vector memory tenant isolation tests (`tenant-vector-isolation.test.ts`, `tenant-semantic-retrieval-boundary.test.ts`) must be added to the `pr-fast` lane in addition to the nightly run.

**REQ-T5** — An audit of all mutating API endpoints must produce a matrix documenting whether each endpoint relies on RLS, `requireOwnership`, `requirePermission`, or none. Endpoints with "none" must be remediated or have a documented risk acceptance before production promotion.

### Domain 2: Security (P1)

**REQ-S1** — The two exposed Supabase project keys (`wfhdrrpijqygytvoaafc`, `bxaiabnqalurloblfwua`) must be rotated via the Supabase dashboard. Evidence: rotation ticket linked in `docs/security-compliance/secret-rotation-log.md` with new key hash and rotation date.

**REQ-S2** — A secret rotation policy document must be created at `docs/security-compliance/secret-rotation-policy.md` covering:
- Owner split: AWS KMS/Secrets Manager = source of truth + rotation authority; Infisical = distribution + access control layer
- Per-secret-class rotation frequency (e.g., DB credentials: 30 days; API keys: 90 days; JWT signing keys: 180 days or on compromise)
- Propagation path: how a rotated secret reaches running services (ExternalSecret → k8s Secret → pod env)
- Automated rotation: AWS Secrets Manager rotation lambdas for infra secrets; Infisical scheduled rotation for app secrets
- Manual rotation runbook reference for secrets that cannot be automated

**REQ-S3** — The `secret-rotation-verification.yml` workflow stub must be completed to: (a) verify that secrets in AWS Secrets Manager were rotated within their policy window, (b) emit a CI failure if any secret is overdue, and (c) write a rotation event to `secret-rotation-log.md` on success.

**REQ-S4** — IDOR audit: produce `docs/security-compliance/idor-audit.md` mapping each mutating API endpoint to its authorization mechanism. Endpoints with no mechanism must be remediated before production promotion.

**REQ-S5** — Dev-only routes and middleware must be gated by `NODE_ENV !== 'production'`. A CI check must verify no dev-only route is reachable in a production build.

### Domain 3: Testing / CI (P2)

**REQ-C1** — Flake tracking (Phase 1, release-blocking):
- Integrate a retry-aware reporter into Vitest config that records per-test retry counts
- Compute flake rate = (tests that passed only after retry) / (total test runs) over the run window
- Emit flake rate as a CI summary metric
- Fail CI if flake rate exceeds 2% in any single run
- Output: `artifacts/ci-lanes/flake-report/flake-summary.json` artifact on every run

**REQ-C2** — Flake automation (Phase 2, time-boxed follow-on, not release-blocking):
- Auto-tag flaky tests with `@flaky` and skip after N consecutive failures
- Auto-open a GitHub issue per flaky test with test name, file, flake rate, and CODEOWNERS assignment
- SLA: flaky tests must be fixed or removed within 2 sprints

**REQ-C3** — A11y smoke on PR: `tests/accessibility/axe-a11y.spec.ts` must run on every PR against a built frontend. Critical and serious violations must block merge. The nightly deeper run continues for trend analysis.

**REQ-C4** — Performance smoke on PR: `tests/performance/route-load-budgets.spec.ts` must run on every PR. Budget breaches must block merge.

**REQ-C5** — SLO alert rule validation: a CI step must run `promtool check rules` against `infra/k8s/monitoring/prometheus-slo-rules.yaml`, `slo-alerts.yaml`, and `observability-recording-alerts.yaml` on every PR that touches `infra/k8s/monitoring/`.

**REQ-C6** — All existing contract tests (`versioning.contract.test.ts`, `AuditLogService.contract.test.ts`, `CommunicationEvent.contract.test.ts`, `mcpDiscovery.contract.test.ts`, `compliance-mode.contract.test.ts`) must be confirmed in the `pr-fast` lane. Breaking changes without a version bump must fail CI.

### Domain 4: Performance (P3)

**REQ-P1** — N+1 audit: identify the top 10 hot endpoints by request volume and verify each uses batching or a DataLoader pattern. Document findings and remediation plan in `docs/performance_optimization_roadmap.md`.

**REQ-P2** — Caching strategy document: `docs/engineering/caching-strategy.md` must exist covering: what is cached, TTL per cache class, tenant-scoped key format, invalidation strategy, and Redis fallback behavior.

**REQ-P3** — Idempotency keys must be implemented on all BullMQ job submissions that trigger side effects (billing, CRM sync, certificate generation). Unit tests must verify that duplicate submissions with the same idempotency key do not produce duplicate side effects.

### Domain 5: Frontend / A11y (P4)

**REQ-A1** — `SkipLink` must be rendered in `MainLayout.tsx` and verified by a render test that asserts its presence in the DOM on every build.

**REQ-A2** — All async views (pages using `Suspense`) must have both a skeleton/loading fallback and an `ErrorBoundary`. A CI check must flag async views missing either.

**REQ-A3** — WCAG AA contrast: a CI step must run `checkColorContrast` against the Tailwind/design token palette. Any token pair used for text/background that fails 4.5:1 must be flagged and fail CI.

---

## Acceptance Criteria

A control is production-ready when **all three** of the following are true:

1. **Implemented** — the code change exists and passes review
2. **Tested** — a test exercises the control and is in the appropriate CI lane
3. **Evidenced** — CI produces an artifact (test report, SARIF, JSON summary, or audit log entry) linkable from the Trust Portal or compliance evidence index

### Per-requirement acceptance criteria

| Req | Acceptance criteria | Evidence artifact |
|---|---|---|
| REQ-T1 | RLS test count gate in `pr-fast`; ≥10 tests pass on every PR | `vitest-rls.json` in PR artifacts |
| REQ-T2 | Unit test for cache key tenant namespacing passes in `pr-fast` | Test report in `unit/component/schema` lane |
| REQ-T3 | BullMQ cross-tenant isolation test passes in `pr-fast` | Test report |
| REQ-T4 | Vector isolation tests pass in `pr-fast` | Test report |
| REQ-T5 | IDOR audit matrix exists; zero unmitigated "none" endpoints | `docs/security-compliance/idor-audit.md` |
| REQ-S1 | Rotation log entry with ticket link and new key hash | `secret-rotation-log.md` entry |
| REQ-S2 | Rotation policy doc exists with all required fields | `secret-rotation-policy.md` |
| REQ-S3 | Rotation verification workflow runs on schedule; no overdue secrets | Workflow run log |
| REQ-S4 | IDOR audit doc exists; zero unmitigated "none" entries | `idor-audit.md` |
| REQ-S5 | CI check passes; no dev route reachable in production build | CI step output |
| REQ-C1 | Flake report artifact present on every CI run; CI fails if rate > 2% | `flake-summary.json` |
| REQ-C2 | (Phase 2) Auto-quarantine and issue creation working | GitHub issues created for flaky tests |
| REQ-C3 | Axe tests in `pr-fast`; critical/serious violations block merge | `accessibility-audit` lane artifact |
| REQ-C4 | Route load budget tests in `pr-fast`; budget breaches block merge | `performance-smoke` lane artifact |
| REQ-C5 | `promtool check rules` passes on every monitoring PR | CI step output |
| REQ-C6 | Contract tests in `pr-fast`; breaking changes without version bump fail | Test report |
| REQ-P1 | N+1 audit doc exists; confirmed N+1s have remediation plan | `performance_optimization_roadmap.md` update |
| REQ-P2 | Caching strategy doc exists | `docs/engineering/caching-strategy.md` |
| REQ-P3 | Idempotency unit tests pass for BullMQ job submissions | Test report |
| REQ-A1 | `SkipLink` render test passes in `pr-fast` | Test report |
| REQ-A2 | All async views have skeleton + ErrorBoundary; CI check passes | CI step output |
| REQ-A3 | Contrast check passes against design token palette | CI step output |

---

## Implementation Approach

Steps are ordered by priority stack. Each step produces at least one evidence artifact before the next begins.

### Phase 0 — Immediate (operational, no code changes required)

1. **Rotate exposed Supabase keys** (REQ-S1) — rotate both projects (`wfhdrrpijqygytvoaafc`, `bxaiabnqalurloblfwua`) via the Supabase dashboard; update all environment secrets (CI, staging, production); add rotation log entry with ticket link and new key hash.

### Phase 1 — Tenancy / RLS hardening

2. **Promote RLS tests to PR gate** (REQ-T1) — move the RLS test invocation from `nightly-governance.yml` into `pr-fast.yml`; keep nightly run for deeper coverage.
3. **Redis cache key tenant namespacing test** (REQ-T2) — add unit test for `buildLLMCacheKey` asserting tenant prefix and throw-on-missing-tenant; add to `unit/component/schema` lane.
4. **BullMQ cross-tenant isolation test** (REQ-T3) — write integration test verifying `tenantContextStorage.run()` prevents cross-tenant data access in worker processing; add to `pr-fast`.
5. **Vector isolation tests on PR** (REQ-T4) — add `tenant-vector-isolation.test.ts` and `tenant-semantic-retrieval-boundary.test.ts` to `pr-fast` lane.
6. **IDOR audit** (REQ-T5 + REQ-S4) — enumerate all mutating API endpoints; produce `docs/security-compliance/idor-audit.md`; remediate any endpoint with no authorization mechanism.

### Phase 2 — Security controls

7. **Secret rotation policy doc** (REQ-S2) — create `docs/security-compliance/secret-rotation-policy.md` with AWS KMS / Infisical responsibility split, per-class frequencies, propagation paths, and runbook references.
8. **Secret rotation verification workflow** (REQ-S3) — complete `secret-rotation-verification.yml` to check AWS Secrets Manager rotation dates against policy; emit failure on overdue secrets.
9. **Dev route production gate** (REQ-S5) — add `scripts/ci/check-dev-routes-production.mjs` and a CI step that builds the backend with `NODE_ENV=production` and asserts no dev-only routes are registered.

### Phase 3 — Testing / CI enforcement

10. **Flake tracking (Phase 1)** (REQ-C1) — integrate retry-aware reporter into Vitest config; add `scripts/ci/flake-gate.mjs` to compute flake rate; add `flake-gate` step to `pr-fast` and `main-verify`; emit `flake-summary.json` artifact.
11. **A11y smoke on PR** (REQ-C3) — add `accessibility-smoke` job to `pr-fast.yml` running axe tests against a built frontend; critical/serious violations block merge.
12. **Performance smoke on PR** (REQ-C4) — add `performance-smoke` job to `pr-fast.yml` running route load budget tests; budget breaches block merge.
13. **SLO alert rule validation** (REQ-C5) — add `promtool check rules` step to `pr-fast.yml` triggered on changes to `infra/k8s/monitoring/`.
14. **Contract test lane confirmation** (REQ-C6) — verify all contract tests are in `pr-fast`; add any missing ones.

### Phase 4 — Performance

15. **N+1 audit** (REQ-P1) — identify top 10 hot endpoints; document N+1 findings and remediation plan in `docs/performance_optimization_roadmap.md`.
16. **Caching strategy doc** (REQ-P2) — create `docs/engineering/caching-strategy.md`.
17. **BullMQ idempotency tests** (REQ-P3) — add unit tests for idempotency key enforcement on billing, CRM sync, and certificate generation jobs.

### Phase 5 — Frontend / A11y

18. **SkipLink render test** (REQ-A1) — add render test asserting `SkipLink` is present in `MainLayout`; add to `pr-fast`.
19. **Async view completeness check** (REQ-A2) — add `scripts/ci/check-async-view-completeness.mjs` asserting all `Suspense`-wrapped views have a skeleton fallback and `ErrorBoundary`.
20. **Design token contrast check** (REQ-A3) — add `scripts/ci/check-design-token-contrast.mjs` running `checkColorContrast` against the Tailwind palette; fail on any text/background pair below 4.5:1.

### Phase 6 — Flake automation (follow-on, not release-blocking)

21. **Flake quarantine + ticketing** (REQ-C2) — implement auto-tagging of flaky tests, auto-open GitHub issues, and CODEOWNERS-based assignment.

---

## Files to Create / Modify

| File | Action | Requirement |
|---|---|---|
| `docs/security-compliance/secret-rotation-log.md` | Update — add rotation entries for G-01 | REQ-S1 |
| `docs/security-compliance/secret-rotation-policy.md` | Create | REQ-S2 |
| `docs/security-compliance/idor-audit.md` | Create | REQ-S4, REQ-T5 |
| `docs/engineering/caching-strategy.md` | Create | REQ-P2 |
| `docs/performance_optimization_roadmap.md` | Update — N+1 audit section | REQ-P1 |
| `.github/workflows/secret-rotation-verification.yml` | Complete stub | REQ-S3 |
| `.github/workflows/pr-fast.yml` | Add: RLS gate, vector isolation, a11y smoke, perf smoke, flake gate, SLO rule check | REQ-T1, T4, C1, C3, C4, C5 |
| `packages/backend/src/services/post-v1/__tests__/LLMCacheKey.tenant.test.ts` | Create | REQ-T2 |
| `packages/backend/src/workers/__tests__/BullMQTenantIsolation.test.ts` | Create | REQ-T3 |
| `packages/backend/src/workers/__tests__/BullMQIdempotency.test.ts` | Create | REQ-P3 |
| `apps/ValyntApp/src/layouts/__tests__/MainLayout.a11y.test.tsx` | Create | REQ-A1 |
| `scripts/ci/check-dev-routes-production.mjs` | Create | REQ-S5 |
| `scripts/ci/check-async-view-completeness.mjs` | Create | REQ-A2 |
| `scripts/ci/check-design-token-contrast.mjs` | Create | REQ-A3 |
| `scripts/ci/flake-gate.mjs` | Create | REQ-C1 |
