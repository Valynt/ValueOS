# Spec: Production Readiness Sprint Plan

**Based on:** Manus AI Senior Technical Lead review (2026-03-12)  
**Codebase audit date:** 2026-03-12  
**Format:** Flat prioritized task list. Items marked ✅ VERIFIED are already correctly implemented — the task is to confirm and document, not re-implement.

---

## Problem Statement

The ValueOS platform has strong foundational security and CI controls but carries material gaps in code quality, test coverage, and operational readiness that must be closed before enterprise B2B launch. This spec translates the Manus AI sprint plan into a grounded task list, adjusted for actual codebase state.

**Key findings from codebase audit:**
- Several P0 security items from the Manus plan are already implemented (CORS wildcard rejection, Docker Compose env-var enforcement, frontend bundle service-role CI check, worker HPA). These need verification and documentation, not re-implementation.
- The `versioning.ts` middleware has unreachable code (multiple `return` statements before `next()`) — a genuine showstopper bug.
- 13 release-critical test waivers exist; most have legitimate reasons (OAuth live provider, HTTPS-only). One (R1-SKIP-002) is fixable without external dependencies.
- TypeScript `any` actual count is ~1,087 production files (re-measured 2026-03-12), down from the 1,955 baseline. Target: 25% reduction from 1,087 = ≤815.
- Two `ValueTreeService` files exist (one is a full duplicate, not a barrel). Two `AuditLogService` files exist (one is a re-export barrel — acceptable).
- OpenAPI spec covers only `/api/v1/projects` — all other endpoints are undocumented.
- No formal SLO/SLI document exists for key user journeys.

---

## Requirements

### P0 — Showstopper / Launch Blocking

---

#### TASK-001: Fix unreachable code in `versioning.ts` (BUG-001)

**File:** `packages/backend/src/versioning.ts`

**Problem:** Lines 30–37 contain three consecutive `return res.setHeader(...)` statements before the `next()` call. Only the first `return` executes; the 426 response and the deprecated-versions header are never sent. The middleware silently passes all requests through without setting the deprecation header or rejecting unsupported versions.

**Fix:**
1. Remove the spurious `return` before `res.setHeader('API-Version', DEFAULT_VERSION)` on the unsupported-version branch.
2. Restructure so the 426 response is actually returned when the version is unsupported.
3. Move the `API-Deprecated-Versions` header set to after the version is resolved (not inside the unsupported branch).
4. Ensure `next()` is only called on the happy path.

**Acceptance criteria:**
- [ ] A request with an unsupported version receives HTTP 426 with `error: "unsupported_version"`.
- [ ] A request with a supported version receives the correct `API-Version` response header.
- [ ] `API-Deprecated-Versions` header is set when `DEPRECATED_VERSIONS` is non-empty.
- [ ] Unit test covers all three branches (unsupported, supported+deprecated, supported+clean).

---

#### TASK-002: Verify MFA env-var wiring and enforce in production (SEC-001)

**Files:** `packages/backend/src/config/environment.ts`, `packages/backend/src/services/AuthService.ts`

**Problem:** `mfaEnabled` is read from `MFA_ENABLED === "true"` and passed through config, but it is unclear whether production deployments set this flag.

**Fix:**
1. Audit `AuthService` to confirm `mfaEnabled: false` is not the default in production config.
2. Add a startup assertion: if `NODE_ENV === "production"` and `MFA_ENABLED !== "true"`, emit a `WARN` log and surface it in the health check response.
3. Document `MFA_ENABLED=true` as a required production env var in `.env.example` and `DEPLOY.md`.

**Acceptance criteria:**
- [ ] `MFA_ENABLED` is documented as required in `.env.example`.
- [ ] Backend startup emits a warning if `MFA_ENABLED` is not `"true"` in production.
- [ ] Existing `AuthService` tests still pass.

---

#### TASK-003: Verify CORS wildcard rejection ✅ VERIFIED — document only (SEC-002)

**Finding:** `parseCorsAllowlist` already throws on wildcard origins when `credentials: true`. The `getConfig()` call passes `requireNonEmpty: true`. CI test `corsAllowlist.test.ts` covers this.

**Task:** Confirm `CORS_ORIGINS` is documented as a required production env var in `.env.example` and `DEPLOY.md`. Add a gate to `docs/operations/go-live-security-checklist.md` for CORS origin validation.

**Acceptance criteria:**
- [ ] `CORS_ORIGINS` appears in `.env.example` with a comment that it must not contain `*`.
- [ ] `docs/operations/go-live-security-checklist.md` includes a CORS origin validation gate.

---

#### TASK-004: Verify Docker Compose credential enforcement ✅ VERIFIED — document only (SEC-003)

**Finding:** `ops/compose/compose.yml` uses `${PGPASSWORD:?Set PGPASSWORD in ops/env/.env.local}` — no default credentials are hardcoded.

**Task:** Confirm the same `${VAR:?...}` pattern is used in all compose files under `ops/compose/profiles/`. Add a note to `DEPLOY.md` that `ops/env/.env.local` must be populated before `docker compose up`.

**Acceptance criteria:**
- [ ] All compose files under `ops/compose/` use `${VAR:?...}` syntax for credentials.
- [ ] `DEPLOY.md` references `ops/env/.env.local` setup as a prerequisite.

---

#### TASK-005: Verify frontend bundle service-role CI check ✅ VERIFIED — document only (SEC-004)

**Finding:** `scripts/ci/check-frontend-bundle-service-role.mjs` exists and runs in CI as `pnpm check:frontend-bundle-service-role`.

**Task:** Confirm the check runs on every PR (not just nightly). Verify a production build of ValyntApp does not contain `SUPABASE_SERVICE_ROLE_KEY` in any JS chunk.

**Acceptance criteria:**
- [ ] CI job `unit-component-schema` includes the `Guard frontend bundle service-role identifiers` step on every PR.
- [ ] A production build of ValyntApp does not contain the string `SUPABASE_SERVICE_ROLE_KEY` in any JS chunk.

---

#### TASK-006: Remove committed Windows user directory `c:/` (QUAL-001)

**Finding:** `/workspaces/ValueOS/c:/Users/` directory exists in the repository root — an accidentally committed Windows path.

**Fix:**
1. `git rm -r "c:/"` to remove from tracking.
2. Add `c:/` to `.gitignore`.

**Acceptance criteria:**
- [ ] `c:/` directory is removed from the repository.
- [ ] `.gitignore` prevents re-commit.

---

### P1 — High Priority

---

#### TASK-007: Un-skip R1-SKIP-002 (critical error-handling E2E test) (TEST-001)

**File:** `tests/e2e/critical-user-flow.spec.ts` line 149

**Problem:** `TEST-E2E-CRITICAL-003` (data load error handling) is skipped. The waiver reason is "requires API-failure mocking harness not yet wired into Playwright runtime." This is fixable using Playwright's `page.route()` API — no external dependencies needed.

**Fix:**
1. Implement the test using `page.route('/api/**', route => route.fulfill({ status: 500 }))` to simulate API failure.
2. Assert the error state UI is shown.
3. Assert retry functionality works.
4. Remove the `test.skip()` call and remove R1-SKIP-002 from `config/release-risk/release-1.0-skip-waivers.json`.

**Acceptance criteria:**
- [x] `TEST-E2E-CRITICAL-003` runs and passes in CI without external dependencies.
- [x] R1-SKIP-002 entry removed from the waiver file.
- [ ] Remaining waivers (R1-SKIP-003 through R1-SKIP-013) have confirmed owners and non-expired expiry dates.

---

#### TASK-008: Verify frontend tenant isolation in `getBenchmarks()` and `getOntologyStats()` (SEC-006)

**File:** `packages/backend/src/services/ValueFabricService.ts`

**Finding:** Both methods call `this.requireOrganizationId(organizationId)` and scope queries with `.eq("organization_id", organizationId)`. Backend implementation appears correct.

**Task:**
1. Confirm no frontend-side callers invoke these methods without passing `organizationId`.
2. Fix any call sites that omit tenant scoping.
3. Add unit tests asserting cross-tenant reads return empty results.

**Acceptance criteria:**
- [ ] No call site invokes `getBenchmarks` or `getOntologyStats` without an explicit `organizationId`.
- [ ] Unit tests confirm tenant isolation for both methods.

---

#### TASK-009: TypeScript `any` debt reduction (QUAL-003)

**Current measured count (2026-03-12):** ~1,087 production `any` usages (packages + apps, excluding test files).  
**Target:** ≤815 (25% reduction from current actuals).

**Per-package breakdown:**
| Package | Current | Target |
|---|---|---|
| `packages/backend/src` | 549 | ≤412 |
| `apps/ValyntApp/src` | 181 | ≤136 |
| `packages/sdui` | 116 | ≤87 |
| `packages/mcp` | 106 | ≤80 |
| `apps/VOSAcademy` | 61 | ≤46 |
| `packages/shared` | 45 | ≤34 |

**Approach:**
1. Update `ts-any-baseline.json` with current measured counts per package.
2. Replace `any` with `unknown` + type guards, or with the correct domain type from `packages/shared/src/domain/`.
3. Focus on highest-density files first.

**Acceptance criteria:**
- [ ] `ts-any-baseline.json` updated with current measured counts.
- [ ] Total production `any` count ≤815 at PR merge.
- [ ] No new `any` introduced in files that previously had zero.

---

#### TASK-010: De-duplicate `ValueTreeService` (QUAL-004)

**Files:**
- `packages/backend/src/services/ValueTreeService.ts` — standalone implementation using raw `createClient`
- `packages/backend/src/services/value/ValueTreeService.ts` — domain-aligned implementation using repository pattern

**Task:**
1. Treat `services/value/ValueTreeService.ts` as canonical (aligns with repository pattern used elsewhere).
2. Migrate all imports from `services/ValueTreeService.ts` to `services/value/ValueTreeService.ts`.
3. Delete `services/ValueTreeService.ts`.
4. Note: `services/AuditLogService.ts` is a re-export barrel — no change needed.

**Acceptance criteria:**
- [ ] `packages/backend/src/services/ValueTreeService.ts` (root) is deleted.
- [ ] All imports updated to `services/value/ValueTreeService`.
- [ ] Tests pass after migration.

---

#### TASK-011: Remove legacy root directories `client/`, `server/`, `shared/` (QUAL-006)

**Finding:** These directories exist at the repo root alongside the monorepo `apps/` and `packages/` structure.

**Task:**
1. Audit each directory for any code still imported by active packages (`rg` for import paths).
2. Migrate any necessary components to the appropriate `apps/` or `packages/` location.
3. Delete the directories.
4. Add ESLint import ban rules to prevent re-introduction of `../../client/`, `../../server/`, `../../shared/` paths from monorepo packages.

**Acceptance criteria:**
- [ ] `client/`, `server/`, `shared/` directories removed from repo root.
- [ ] No active package imports from these paths.
- [ ] ESLint rule blocks future imports from these paths.

---

#### TASK-012: Increase CI coverage thresholds (CI-001)

**Current thresholds** (in `ci.yml`): lines=60, functions=50, branches=50, statements=60.  
**Target:** lines=75, functions=70, branches=70, statements=75.

**Task:**
1. Run the current test suite to confirm actual coverage levels before raising thresholds.
2. If actual coverage is already above targets, raise thresholds immediately.
3. If gaps exist, add targeted tests for the lowest-coverage packages before raising.

**Acceptance criteria:**
- [ ] CI `vitest run --coverage` passes with lines=75, functions=70, branches=70, statements=75.
- [ ] `quality-baselines.json` updated to reflect new thresholds.

---

#### TASK-013: Remove `console.log` from production backend code (QUAL-007)

**Current count:** 4 `console.log` calls in non-test backend files.

**Task:** Replace all `console.log` calls in `packages/backend/src` (excluding test files) with the project's `logger` utility. Enable ESLint `no-console` rule for `packages/backend/src`.

**Acceptance criteria:**
- [ ] Zero `console.log` calls in `packages/backend/src` outside of test files.
- [ ] ESLint `no-console` rule enabled for `packages/backend/src`.

---

### P1 — Infrastructure & Resilience

---

#### TASK-014: Verify worker HPA is queue-depth-driven ✅ VERIFIED — document only (INFRA-001)

**Finding:** `infra/k8s/base/worker-hpa.yaml` exists with `HorizontalPodAutoscaler` scaling on `bullmq_queue_waiting_jobs` and `bullmq_queue_delayed_jobs` external metrics. `minReplicas: 2`, `maxReplicas: 12`.

**Task:** Confirm `infra/k8s/base/prometheus-adapter-rules.yaml` correctly exposes both BullMQ queue metrics. Document the HPA configuration in `docs/operations/deployment-guide.md`.

**Acceptance criteria:**
- [ ] `prometheus-adapter-rules.yaml` defines both BullMQ queue metrics.
- [ ] Deployment guide documents HPA scaling behavior and thresholds.

---

#### TASK-015: Implement and document database backup and PITR strategy (INFRA-002)

**Finding:** `docs/operations/production-launch-checklist.md` references `rclone` and `kopia` for backups but no automated backup policy document exists.

**Task:**
1. Create `docs/operations/backup-and-recovery.md` documenting: backup schedule, retention policy, PITR window, restore procedure, and RTO/RPO targets.
2. If using Supabase Cloud, document the built-in PITR configuration. If self-hosted, document the `kopia` snapshot schedule.
3. Define initial targets: RTO ≤4h, RPO ≤1h.

**Acceptance criteria:**
- [ ] `docs/operations/backup-and-recovery.md` exists with schedule, retention, RTO, RPO, and restore steps.
- [ ] Document is linked from `docs/operations/README.md`.

---

#### TASK-016: Conduct and document first DR drill (INFRA-003)

**Task:**
1. Execute the restore procedure from `backup-and-recovery.md` against a staging environment.
2. Measure actual RTO and RPO.
3. Record results in `docs/operations/dr-drill-log.md` with date, environment, measured RTO/RPO, and gaps found.

**Acceptance criteria:**
- [ ] `docs/operations/dr-drill-log.md` exists with at least one completed drill entry.
- [ ] Measured RTO and RPO are within defined targets, or a remediation plan is documented.

---

#### TASK-017: Baseline load tests for critical API endpoints (TEST-002)

**Target endpoints:** `POST /api/llm` (agent invocation), `POST /api/v1/cases` (case creation).

**Task:**
1. Write k6 or autocannon scripts for both endpoints.
2. Run against staging with 50 concurrent users for 5 minutes.
3. Record p50/p95/p99 latency and error rate.
4. Store results in `docs/operations/load-test-baselines.md`.

**Acceptance criteria:**
- [ ] Load test scripts exist in `tests/load/` or `scripts/load/`.
- [ ] Baseline results documented with p95 latency and error rate.
- [ ] p95 latency for case creation ≤2s at 50 concurrent users (or document actual baseline if higher).

---

#### TASK-018: Expand chaos tests to cover DB and Redis failure (TEST-003)

**Task:**
1. Add a chaos test that simulates Postgres connection failure and verifies the backend returns a structured error (not a 500 stack trace).
2. Add a chaos test that simulates Redis unavailability and verifies BullMQ jobs are not silently dropped.
3. Place tests in `tests/chaos/` with a `README` explaining how to run them.

**Acceptance criteria:**
- [ ] Two new chaos test scenarios: DB failure and Redis failure.
- [ ] Both tests pass (system handles the failure gracefully).

---

#### TASK-019: Ensure release-critical migrations have rollback scripts (TEST-004)

**Finding:** 115 migration files, 20 rollback files — 95 migrations lack rollback scripts.

**Task:**
1. Identify migrations added since `20260101000000` that touch release-critical tables (`value_cases`, `workflow_states`, `agent_runs`, `organizations`, `users`).
2. Write rollback scripts for those migrations.
3. Add a CI check that fails if a new migration file is added without a corresponding `.rollback.sql`.

**Acceptance criteria:**
- [ ] All migrations added in this sprint have paired rollback scripts.
- [ ] CI check validates rollback pairing for release-critical tables.

---

#### TASK-020: Tune HPA scale-down window (INFRA-004)

**Finding:** `worker-hpa.yaml` has `scaleDown.stabilizationWindowSeconds: 300`.

**Task:** Change `stabilizationWindowSeconds` from 300 to 150. Add a comment explaining the rationale (BullMQ jobs take up to 3 min; 150s gives a 50% buffer while being more responsive than 300s).

**Acceptance criteria:**
- [ ] `worker-hpa.yaml` `scaleDown.stabilizationWindowSeconds` is 150.
- [ ] Comment explains the reasoning.

---

### P1 — Operations & Documentation

---

#### TASK-021: Execute production launch checklist and go-live security checklist (OPS-001)

**Files:** `docs/operations/production-launch-checklist.md`, `docs/operations/go-live-security-checklist.md`

**Task:**
1. Replace all placeholder variables (`APP_DOMAIN`, `SUPABASE_PROJECT_REF`, etc.) with production values.
2. Execute each gate command and record pass/fail evidence.
3. Store evidence artifacts in `docs/operations/launch-evidence/`.

**Acceptance criteria:**
- [ ] All blocking gates in both checklists pass.
- [ ] Evidence artifacts stored and linked from the checklist documents.

---

#### TASK-022: Update `DEPLOY.md` to reference canonical `ops/compose/` structure (DOCS-001)

**Finding:** Root `docker-compose.yml` and `docker-compose.deps.yml` are thin passthrough wrappers to `ops/compose/compose.yml`.

**Task:** Update `DEPLOY.md` to point to `ops/compose/` as the canonical location. Annotate root compose files as deprecated wrappers.

**Acceptance criteria:**
- [ ] `DEPLOY.md` references `ops/compose/compose.yml` as the canonical compose file.
- [ ] Root compose files are annotated as deprecated wrappers.

---

#### TASK-023: Expand OpenAPI spec to cover all public API endpoints (DOCS-002)

**Finding:** `packages/backend/openapi.yaml` covers only `/api/v1/projects` and `/api/v1/projects/{projectId}`.

**Task:**
1. Audit all Express routers in `packages/backend/src/api/` to enumerate public endpoints.
2. Add OpenAPI path definitions for: cases, agents, workflows, auth, value-fabric, integrity, narrative, realization, expansion.
3. Validate the spec with the existing OpenAPI tooling.

**Acceptance criteria:**
- [ ] All public-facing API endpoints have OpenAPI path definitions.
- [ ] OpenAPI spec validates without errors.

---

#### TASK-024: Create ADRs for undocumented architectural decisions (DOCS-003)

**Finding:** The ADR directory has 8 entries. Major recent decisions (agent fabric design, CI security gate model, service de-duplication) are not documented.

**Task:** Write ADRs for:
1. Agent fabric architecture (8-agent fabric, BaseAgent, secureInvoke pattern)
2. CI security gate design (guard scripts, waiver system)
3. Service de-duplication approach (canonical service pattern, barrel re-exports)

**Acceptance criteria:**
- [ ] Three new ADR files in `docs/engineering/adr/` following the existing naming convention.
- [ ] `decisions.md` updated with digest entries for each new ADR.

---

#### TASK-025: Define and document SLOs/SLIs for key user journeys (OPS-002)

**Task:**
1. Define SLOs for: API availability (target: 99.9%), case creation latency p95 (target: ≤2s), agent invocation latency p95 (target: ≤10s).
2. Map each SLO to a Prometheus metric (SLI).
3. Document in `docs/operations/slo-sli.md`.
4. Create Prometheus alerting rules in `infra/k8s/monitoring/` for SLO burn rate.

**Acceptance criteria:**
- [ ] `docs/operations/slo-sli.md` exists with SLO definitions, SLI metrics, and error budget policy.
- [ ] At least one Prometheus alerting rule fires when the SLO burn rate exceeds threshold.

---

### P2 — Lower Priority

---

#### TASK-026: Execute feature flag transition from `beta_*` to `ga_*` (OPS-003)

**Reference:** `docs/operations/launch-readiness.md` contains the full migration runbook.

**Task:** Follow the Beta → GA Migration runbook: audit `beta_*` flags, enable dual-write window, cut over to `ga_*`, delete `beta_*` rows after verification.

**Acceptance criteria:**
- [ ] No `beta_*` feature flags remain active in production after cutover.
- [ ] Rollback procedure tested on staging before production cutover.

---

#### TASK-027: Validate WCAG accessibility and localization completeness (OPS-004)

**Task:**
1. Run `tests/accessibility/axe-a11y.spec.ts` and `tests/accessibility/wcag-compliance.test.ts` against the production build.
2. Run `scripts/ci/check-i18n-keys.mjs` and confirm zero missing keys.
3. Document results in `docs/operations/launch-evidence/accessibility-report.md`.

**Acceptance criteria:**
- [ ] Zero WCAG 2.1 AA violations in axe scan of critical user flows.
- [ ] Zero missing i18n keys.

---

## Overall Launch Gate

The platform is ready for enterprise B2B launch when:

1. TASK-001: `versioning.ts` bug fixed and tested.
2. TASK-002 through TASK-006: All P0 security items verified with documentation evidence.
3. TASK-007: R1-SKIP-002 test un-skipped and passing.
4. TASK-009: TypeScript `any` count ≤815 in production files.
5. TASK-010: `ValueTreeService` duplicate removed.
6. TASK-011: Legacy root directories removed.
7. TASK-012: CI coverage thresholds at 75/70/70.
8. TASK-015 + TASK-016: Backup/recovery documentation and first DR drill complete.
9. TASK-021: Production launch checklist fully executed with evidence.
10. TASK-023: OpenAPI spec covers all public endpoints.
11. TASK-025: SLO/SLI document and alerting rules in place.

---

## Implementation Order

Recommended execution sequence based on dependencies and risk:

1. TASK-006 — Remove `c:/` directory (trivial, no risk)
2. TASK-001 — Fix `versioning.ts` bug (P0 bug, isolated change)
3. TASK-003, TASK-004, TASK-005 — Verify and document security items
4. TASK-002 — MFA env-var wiring
5. TASK-010 — De-duplicate `ValueTreeService`
6. TASK-013 — Remove `console.log`
7. TASK-009 — TypeScript `any` reduction (bulk work, parallelizable)
8. TASK-007 — Un-skip R1-SKIP-002 E2E test
9. TASK-008 — Frontend tenant isolation verification
10. TASK-011 — Remove legacy directories (requires import audit first)
11. TASK-012 — Raise CI coverage thresholds (after test additions)
12. TASK-019 — Migration rollback scripts
13. TASK-020 — HPA scale-down tuning
14. TASK-014 — Verify worker HPA documentation
15. TASK-015, TASK-016 — Backup/recovery docs and DR drill
16. TASK-017, TASK-018 — Load and chaos tests
17. TASK-022, TASK-023, TASK-024, TASK-025 — Documentation and ADRs
18. TASK-021 — Execute production launch checklist (final gate)
19. TASK-026, TASK-027 — Feature flag transition and accessibility (P2)
