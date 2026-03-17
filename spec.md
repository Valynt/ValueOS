# Spec: Comprehensive Repository Audit Report — ValueOS

## Problem Statement

ValueOS is a production B2B SaaS platform serving paying customers. A full enterprise-grade audit is required to establish a graded baseline across all engineering dimensions (security, architecture, code quality, CI/CD, observability, frontend, DevEx, compliance) and produce a prioritised remediation roadmap. This spec supersedes all prior ad-hoc findings.

**Scope constraints agreed:**
- Compliance frameworks: SOC 2 Type II + GDPR (PCI DSS out of scope — Stripe is the merchant; ValueOS compliance guide confirms N/A)
- i18n coverage excluded from grading (infrastructure exists; coverage is a future roadmap item)
- DAST gate must be tightened: `DAST_FAIL_ON_HIGH=1` is the minimum bar
- Audience: internal engineering team
- Output: single `docs/audits/enterprise-audit-2026.md`
- Grading: current-state grade (A–F) **and** target grade with gap analysis, per section

---

## Requirements

### R1 — Report Structure

The output document must contain exactly these top-level sections, in order:

1. Executive Summary
2. Repository Structure
3. Code Quality & Maintainability
4. Security & Compliance
5. Architecture & Scalability
6. CI/CD & DevOps
7. Documentation & Developer Experience
8. Frontend & UX
9. Recommendations & Roadmap
10. Appendix — Grading Rubric & Evidence Index

### R2 — Executive Summary

- Overall health grade (A–F) with one-paragraph justification
- Key strengths (≥3, evidence-backed with file or doc reference)
- Major risks (≥3, evidence-backed, each with file:line or doc reference)
- Top 5 priority recommendations, each with: what, why, effort (S/M/L), owner hint

### R3 — Per-Section Requirements

Each of sections 2–8 must include:

- **Current-state grade** (A–F) with rubric justification
- **Target grade** (what "enterprise bar" looks like for this section)
- **Gap analysis** (delta between current and target, specific evidence)
- **Findings** (each with: ID, severity P0–P3, evidence file:line or doc reference, risk, specific fix, acceptance criteria)

---

#### Section 2 — Repository Structure

Evaluate:
- pnpm monorepo setup: naming conventions, directory layout (`apps/`, `packages/`, `infra/`, `ops/`), module boundaries
- Documentation completeness: README, CONTRIBUTING.md, 12 ADRs in `docs/engineering/adr/`, architecture diagrams
- Orphaned packages or circular dependencies across 15 packages
- `.ona/context/` layer as a structural asset

---

#### Section 3 — Code Quality & Maintainability

Evaluate:
- TypeScript strict mode adherence; `as any` debt (baseline 1,522 across codebase per `docs/debt/ts-any-dashboard.md`; long-term target <100)
- ESLint config completeness: `no-restricted-imports`, `backendModuleBoundaryOverrides`, `backendEgressEnforcement` rules
- Test coverage: current thresholds (75% lines/statements, 70% branches/functions per CI) vs enterprise bar (85%/80%)
- Dead code and TODO tracking: 3 tracked TODOs in backend (with ticket IDs), 19 in frontend — assess quality of tracking vs untracked debt
- Modularity: service file size, extraction patterns (TenantLimits, CanvasActionApplier, AgentRetryTypes), cohesion

---

#### Section 4 — Security & Compliance

All findings below are required. Each must appear as a named sub-finding with ID, severity, evidence, risk, fix, and acceptance criteria.

##### Tenant Isolation / RLS

- **SEC-001 (P0):** `ValueCasesRepository`, `ConversationsRepository`, `ArtifactsRepository` use `createServerSupabaseClient()` (service_role) on every user request — RLS bypassed entirely
  - Evidence: `packages/backend/src/api/valueCases/repository.ts:64`, `api/conversations/repository.ts:80`, `api/artifacts/repository.ts:88`
  - Fix: replace with `createUserSupabaseClient(token)` via a `fromRequest(req)` factory; remove from ESLint allowlist once migrated

- **SEC-002 (P0):** Customer portal `GET /api/customer/value-case/:token` queries `opportunities` table with only `value_case_id` — no `tenant_id` filter
  - Evidence: `packages/backend/src/api/customer/value-case.ts:108-111`
  - Fix: add `.eq("tenant_id", tenantId)` — `tenantId` is already resolved from the `value_cases` row above

- **SEC-004 (P1):** `ConversationHistoryService` queries `conversation_history` by `case_id` only; no `tenant_id` filter; no confirmed RLS migration for this table
  - Evidence: `packages/backend/src/services/value/ConversationHistoryService.ts:59-62`
  - Fix: add `tenant_id` column, RLS migration, `.eq('tenant_id', tenantId)` in all queries

##### Rate Limiting

- **SEC-003 (P0):** `artifacts/index.ts` and `conversations/index.ts` define `standardLimiter`/`strictLimiter` as no-op `(_req, _res, next) => next()` — rate limiting completely absent on these routes
  - Evidence: `packages/backend/src/api/artifacts/index.ts:30-31`, `api/conversations/index.ts:49-50`
  - Fix: replace with `createRateLimiter(RateLimitTier.STANDARD)` / `createRateLimiter(RateLimitTier.STRICT)` from `middleware/rateLimiter.ts`

##### Authentication & Authorization

- **SEC-006 (P1):** Billing mutation endpoints (subscription POST/PATCH) have no `requireMFA` guard; password-update correctly gates with `requireMFA` but billing does not
  - Evidence: `packages/backend/src/api/billing/index.ts` — compare with `api/auth.ts:341`
  - Fix: add `requireMFA` to all billing mutation routes

- **SEC-007 (P1):** `backHalfRouter` auth array omits `tenantDbContextMiddleware()` — `req.db` is `undefined` in all integrity/narrative/realization handlers
  - Evidence: `packages/backend/src/api/valueCases/backHalf.ts:164`
  - Fix: `const auth = [requireAuth, tenantContextMiddleware(), tenantDbContextMiddleware()]`

- **SEC-009 (P2):** `RBAC_CACHE_TTL_SECONDS` env var documented in `.env.example` but `PermissionService` singleton ignores it — hardcoded 5-minute TTL cannot be tuned
  - Evidence: `packages/backend/src/services/auth/PermissionService.ts:25,385`
  - Fix: `new PermissionService(process.env.RBAC_CACHE_TTL_SECONDS ? Number(process.env.RBAC_CACHE_TTL_SECONDS) * 1000 : undefined)`

- **SEC-010 (P2):** `DEFAULT_TCT_SECRET = "default-tct-secret-change-me"` falls through in development — forged TCTs accepted in dev/local environments
  - Evidence: `packages/backend/src/middleware/tenantContext.ts:25,28`
  - Fix: fail fast in all environments when secret equals default value

##### Observability / Audit

- **SEC-005 (P1):** `auditLogger.ts` uses `navigator.sendBeacon` / `localStorage` (browser-only APIs) in a backend service file — security audit events silently drop server-side
  - Evidence: `packages/backend/src/services/security/auditLogger.ts:13-84`
  - Fix: replace with direct `auditLogService.log()` call from `AuditLogService.ts`

##### Input Validation

- **SEC-011 (P2):** `llm.ts /chat` accepts `maxTokens` and `temperature` from request body with no Zod schema or upper-bound enforcement — unbounded cost exposure
  - Evidence: `packages/backend/src/api/llm.ts:58`
  - Fix: add Zod schema: `maxTokens: z.number().int().min(1).max(8192).optional()`, `temperature: z.number().min(0).max(2).optional()`

##### DAST

- **SEC-008 (P1):** DAST gate (`DAST_FAIL_ON_HIGH=0`, `DAST_FAIL_ON_MEDIUM=0`) never blocks on findings — OWASP ZAP runs but results are advisory only
  - Evidence: `.github/workflows/deploy.yml` — DAST job env vars
  - Fix: set `DAST_FAIL_ON_HIGH=1` immediately; create suppression baseline for known false positives; set `DAST_FAIL_ON_MEDIUM=5` after baseline is established

##### GDPR

- **GDPR-001 (P1):** Assess `dataSubjectRequests.ts` endpoint for completeness: right of access, right of erasure, right of portability — verify all three are implemented and tested
- **GDPR-002 (P2):** Verify `consentMiddleware.ts` covers all data processing categories per `docs/security-compliance/subprocessor-list.md`
- **GDPR-003 (P2):** Confirm `packages/shared/src/lib/piiFilter.ts` blocks all PII categories (SSN, CC, email lists, phone, passport, DOB, healthcare IDs) in structured logs

##### SOC 2

- **SOC2-001 (P2):** Assess `docs/security-compliance/control-traceability-matrix.md` completeness against CC6–CC9 controls; identify any unmapped controls
- **SOC2-002 (P2):** Verify WORM audit archive migration (`infra/supabase/supabase/migrations/20260804000000_security_audit_worm_archive.sql`) is applied in production and immutability is enforced
- **SOC2-003 (P2):** Confirm `access-review-automation.yml` produces evidence artefacts that satisfy CC6.2 (access provisioning review)

##### Supply Chain & Secrets

- Assess External Secrets Operator config (`infra/k8s/base/external-secrets.yaml`) — AWS SM + Vault dual-provider support
- Assess SBOM (CycloneDX via `cyclonedx-npm`) — generated in CI but not uploaded to container registry or signed; assess gap
- Assess cosign keyless image signing in `deploy.yml` — confirm signing covers both backend and frontend images
- Assess Renovate config (`renovate.json`) — weekly schedule, required status checks, auto-merge policy

##### IaC Hardening

- Assess K8s manifests: `securityContext` (runAsNonRoot, readOnlyRootFilesystem, allowPrivilegeEscalation=false), NetworkPolicy, PodDisruptionBudget — all present; assess completeness
- Assess Terraform modules (`infra/terraform/modules/security/`) — security groups, Secrets Manager; note active deploy uses K8s not ECS

---

#### Section 5 — Architecture & Scalability

Evaluate:
- Monorepo service boundaries: 8-agent fabric, 6 runtime services, 15 packages — assess cohesion and dependency direction
- REST API design: OpenAPI spec (2,622 lines at `packages/backend/openapi.yaml`) — assess route coverage, versioning strategy, error envelope consistency
- Data layer: Postgres RLS, migration chain integrity (CI checks present), tenant-leading indexes, backup/DR strategy
- Async processing: BullMQ queues, CloudEvents `MessageBus`, Redis streams — assess idempotency keys, backpressure, DLQ presence
- Multi-tenancy: shared-schema with RLS — assess isolation completeness given SEC-001–004 findings
- Observability: OTel + Prometheus + Loki + Grafana stack (`infra/observability/`), SLOs defined (`infra/observability/SLOs.md`), assess alert coverage and trace propagation
- Blue/green deployment manifests — assess rollback automation

---

#### Section 6 — CI/CD & DevOps

Evaluate:
- Pipeline lanes: unit/component/schema, security-gate, tenant-isolation, accessibility-audit, DAST, deploy
- Required checks: lint, typecheck, test (75%/70% thresholds), CodeQL, Semgrep, gitleaks, SBOM, migration hygiene, i18n key coverage, pseudo-localization
- Branching strategy: assess branch protection rules, CODEOWNERS, required reviewers
- Deployment: K8s kustomize overlays (staging/production), cosign image signing, blue/green strategy
- IaC drift risk: Terraform ECS Fargate module present but active deploy uses K8s — assess documentation and drift risk
- DR: runbook at `docs/runbooks/disaster-recovery.md` — assess RTO/RPO targets, last tested date, staging parity

---

#### Section 7 — Documentation & Developer Experience

Evaluate:
- Onboarding: devcontainer, automations.yaml, `scripts/dx/doctor.js`, CONTRIBUTING.md
- API docs: OpenAPI spec served at `/api/docs` — assess coverage vs actual route count
- ADRs: 12 in `docs/engineering/adr/` — assess recency, coverage of major architectural decisions
- Runbooks: 10+ in `docs/runbooks/` — assess completeness and last-reviewed dates
- Context engineering layer (`.ona/context/` — 6 files) — assess as a DevEx asset and staleness risk
- Living debt tracking: `docs/debt/ts-any-dashboard.md`, `quality-baselines.json` — assess as engineering health instruments

---

#### Section 8 — Frontend & UX

Evaluate:
- Component architecture: React + Vite + Tailwind + shadcn — assess consistency across `apps/ValyntApp/src/components/`
- Accessibility: WCAG 2.2 AA gate (critical=0, serious=0 budget), axe in CI — assess view-level aria density (33 `aria-*` usages across 70 view files)
- Error handling: `ErrorBoundary` present and wraps app + route groups; `componentDidCatch` logs to `console.error` only — not forwarded to error tracking service
- Performance: Vite bundle splitting, lazy loading in `AppRoutes.tsx` — assess bundle budget enforcement and perf CI gate
- State management: assess patterns across 70 views for consistency (Zustand stores, React Query, context)

---

### R4 — Recommendations & Roadmap

Three tiers. Each item must include: what, why, effort (S/M/L), owner hint, success metric.

**Immediate (0–30 days) — P0/P1 blockers:**

| # | What | Why | Effort | Owner | Success Metric |
|---|------|-----|--------|-------|----------------|
| 1 | Fix SEC-001: user-scoped Supabase clients in repositories | RLS bypassed on every user request | M | Backend | `pnpm run test:rls` passes; no `createServerSupabaseClient` in `api/` outside allowlist |
| 2 | Fix SEC-002: tenant_id filter on opportunities query | Cross-tenant data exposure in customer portal | S | Backend | Integration test: tenant B cannot read tenant A's opportunities |
| 3 | Fix SEC-003: replace no-op rate limiters | Zero rate limiting on artifact/conversation writes | S | Backend | 61st request within 1 min returns 429 |
| 4 | Fix SEC-004: tenant_id on conversation_history + RLS migration | Cross-tenant read risk on conversation data | M | Backend + DB | RLS test passes for conversation_history table |
| 5 | Fix SEC-005: server-side audit log delivery | Security audit events silently drop on server | S | Backend | Unit test: `auditLogService.log` called; `navigator` not accessed |
| 6 | Fix SEC-006: requireMFA on billing mutations | Payment method changes unprotected by MFA | S | Backend | `POST /api/billing/subscription` without MFA header → 403 |
| 7 | Fix SEC-007: tenantDbContextMiddleware in backHalfRouter | `req.db` undefined in integrity/narrative/realization handlers | S | Backend | Back-half integration tests pass without `req.db` errors |
| 8 | Fix SEC-008: DAST_FAIL_ON_HIGH=1 | DAST gate never blocks on high-severity findings | S | DevOps | Deploy pipeline fails on next high-severity ZAP finding |

**Near-term (1–3 months) — P1/P2 hardening:**

| # | What | Why | Effort | Owner | Success Metric |
|---|------|-----|--------|-------|----------------|
| 1 | Fix SEC-009–011 (RBAC TTL, TCT default, LLM input validation) | Config drift, forged tokens in dev, cost overrun | S | Backend | Unit tests for each |
| 2 | GDPR-001–003: data subject requests, consent audit, PII filter | GDPR compliance completeness | M | Security + Backend | All three endpoints tested; PII filter covers all categories |
| 3 | SOC2-001–003: control matrix gaps, WORM archive, access review | SOC 2 Type II evidence completeness | M | Security + DevOps | Control matrix has no unmapped CC6–CC9 controls |
| 4 | Reduce `as any` debt: 1,522 → <1,000 | Type safety erosion | L | All teams | `ts-any-dashboard.md` shows <1,000 |
| 5 | Raise test coverage: 75%→80% lines, 70%→75% branches | Enterprise bar is 85%/80% | M | All teams | CI thresholds updated and passing |
| 6 | Add aria-label to icon-only buttons; raise aria density baseline | 33 aria usages across 70 views is insufficient | M | Frontend | axe moderate budget reduced from 10 to 5 |
| 7 | Forward ErrorBoundary errors to error tracking service | Errors not captured in production monitoring | S | Frontend | Error tracking service receives ErrorBoundary events |
| 8 | SBOM upload to container registry + sign | Supply chain provenance incomplete | S | DevOps | SBOM attached to OCI image; cosign verify passes |

**Long-term (3–12 months) — Enterprise bar:**

| # | What | Why | Effort | Owner | Success Metric |
|---|------|-----|--------|-------|----------------|
| 1 | Reduce `as any` to <100 | Long-term target per ts-any-dashboard.md | L | All teams | Dashboard shows <100 |
| 2 | Raise test coverage to 85% lines / 80% branches | Enterprise SaaS standard | L | All teams | CI thresholds at 85%/80% |
| 3 | Resolve Terraform/K8s IaC drift | Terraform ECS module is stale; creates confusion | M | DevOps | Either Terraform removed or kept in sync with K8s |
| 4 | Expand OpenAPI spec to cover all routes | Assess current coverage gap vs actual route count | M | Backend | 100% of routes documented in openapi.yaml |
| 5 | DAST_FAIL_ON_MEDIUM threshold after suppression baseline | Medium findings currently advisory only | M | DevOps | DAST_FAIL_ON_MEDIUM=5 with suppression list |
| 6 | Multi-region DR with documented RTO/RPO and quarterly drills | DR runbook exists but RTO/RPO targets not tested | L | Platform | Quarterly DR drill passes; RTO <4h documented |
| 7 | Promote conversation_history to full RLS parity | Currently lacks tenant_id column and RLS migration | M | DB | RLS test suite covers conversation_history |

---

### R5 — Grading Rubric (Appendix)

The following scale is applied consistently across all sections:

| Grade | Meaning |
|-------|---------|
| A | Meets or exceeds enterprise bar; no material gaps |
| B | Minor gaps; no blockers; addressable in <30 days |
| C | Moderate gaps; 1–2 P1 findings; addressable in 1–3 months |
| D | Significant gaps; P0 findings present or multiple P1s |
| F | Critical failures; launch-blocking; immediate action required |

---

### R6 — Evidence Index (Appendix)

A table with columns: Finding ID | Severity | File:Line or Doc | Status | Owner

All 19 findings (SEC-001–011, GDPR-001–003, SOC2-001–003) must appear in this table.

---

## Acceptance Criteria

1. `docs/audits/enterprise-audit-2026.md` exists and contains all 10 sections
2. Every finding has: ID, severity (P0–P3), evidence (file:line or doc), risk statement, specific fix, acceptance criteria
3. Every section (2–8) has a current-state grade, target grade, and gap analysis
4. All 11 SEC findings (SEC-001 through SEC-011) are present with diffs or fix descriptions
5. GDPR-001–003 and SOC2-001–003 findings are present and assessed
6. Roadmap items are in three tiers (Immediate / Near-term / Long-term) with effort, owner, and success metric
7. Grading rubric (A–F) is defined in the appendix and applied consistently across all sections
8. No finding is vague — every recommendation is specific, measurable, and testable
9. This report supersedes all prior ad-hoc findings
10. File is valid Markdown, renders cleanly in GitHub, and is ≤ 1,500 lines
11. Key source files (SEC-001–008) have inline code annotations added

---

## Implementation Approach

Ordered steps:

1. Create `docs/audits/enterprise-audit-2026.md`
2. Write **Executive Summary** — overall grade, strengths, risks, top-5 recommendations
3. Write **Section 2: Repository Structure** — grade monorepo layout, naming, docs, ADRs
4. Write **Section 3: Code Quality** — grade TypeScript strictness, `as any` debt, coverage, dead code, modularity
5. Write **Section 4: Security & Compliance** — all SEC-001–011, GDPR-001–003, SOC2-001–003 with diffs; grade current vs target
6. Write **Section 5: Architecture & Scalability** — service boundaries, API design, data layer, async, multi-tenancy, observability
7. Write **Section 6: CI/CD & DevOps** — pipeline lanes, required checks, branching, deployment, DR
8. Write **Section 7: Documentation & DevEx** — onboarding, API docs, ADRs, runbooks, context layer
9. Write **Section 8: Frontend & UX** — component architecture, a11y, error handling, performance
10. Write **Section 9: Recommendations & Roadmap** — all three tiers with effort/owner/metric
11. Write **Section 10: Appendix** — grading rubric table + evidence index table
12. Add inline code annotations to key source files for SEC-001–008
13. Verify: file ≤1,500 lines, all sections present, all acceptance criteria met
