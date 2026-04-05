---
owner: team-platform
generated_at: 2026-04-05
source_commit: fe8b2fb54a61
status: active
---

# Sprint Plan — Sprints 35–38
# ValueOS Enterprise Readiness

**Baseline:** Sprint 34 complete. Last delivered: US-007 tenant context UI, Sprint 33 TypeScript any reductions (backend 546→446).
**Next sprint:** Sprint 35
**Team size:** 4+ engineers (~12–20 items per sprint)
**Sequencing principle:** Balanced mix — security + code quality + user-facing items each sprint.
**Source documents:** `spec.md` (F-001–F-014), `spec-production-readiness.md` (TASK-001–027), `spec-auth-hardening.md` (R1–R6), open GitHub issues (#1540–#1555, #1143–#1144).

---

## Full Item Inventory

### Security & Governance (from spec.md)

| ID | Severity | Effort | Description |
|---|---|---|---|
| F-001 | Critical | L | `ComplianceControlStatusService` returns hash-derived fake compliance scores |
| F-002 | Critical | M | `lib/agent-fabric/AuditLogger.ts` is an empty stub |
| F-003 | Critical | S | `lib/agent-fabric/ExternalAPIAdapter.ts` is an empty stub |
| F-004 | High | S | `secureInvoke` hardcodes `userId: "system"` — real user ID not forwarded |
| F-005 | High | M | Emergency auth fallback has no TTL and uses in-process counter |
| F-006 | High | S | `ComplianceControlStatusService.scoreFor` uses SHA-1 |
| F-007 | High | M | Agent policy files missing for 5 of 8 agents; default lists wrong models |
| F-008 | High | M | `crossReferenceMemory` and `ComplianceAuditorAgent` use `include_cross_workspace: true` with no gate |
| F-009 | Medium | S | All agents hardcode `version: "1.0.0"` in `BaseAgent` constructor |
| F-010 | Medium | M | Model cards reference wrong model names and fake `prompt_contract_hash` values |
| F-011 | Medium | M | DSR erasure endpoint missing 7 agent output tables (GDPR Art. 17 gap) |
| F-012 | Medium | M | `MemorySystem` TTL not enforced on reads |
| F-013 | Medium | L | `AgentIdentity` has no cryptographic binding; `permissions: []` always empty |
| F-014 | Medium | S | SSE compliance stream `setInterval` never cleared on client disconnect |

### Production Readiness (from spec-production-readiness.md)

| ID | Priority | Effort | Description |
|---|---|---|---|
| TASK-001 | P0 | S | Fix unreachable code in `versioning.ts` (426 response never sent) |
| TASK-002 | P0 | S | Add startup assertion when `MFA_ENABLED` is not `"true"` in production |
| TASK-003 | P0 | S | Document CORS wildcard rejection in `.env.example` and go-live checklist |
| TASK-004 | P0 | S | Document Docker Compose credential enforcement in `DEPLOY.md` |
| TASK-005 | P0 | S | Verify frontend bundle service-role CI check runs on every PR |
| TASK-006 | P0 | S | Remove accidentally committed `c:/Users/` directory |
| TASK-007 | P1 | S | Un-skip E2E test `TEST-E2E-CRITICAL-003` using `page.route()` |
| TASK-008 | P1 | M | Audit + unit-test frontend tenant isolation in `getBenchmarks`/`getOntologyStats` |
| TASK-009 | P1 | L | TypeScript `any` reduction: backend <400, ValyntApp <200, sdui <150 |
| TASK-010 | P1 | S | De-duplicate `ValueTreeService` (delete root `services/ValueTreeService.ts`) |
| TASK-011 | P1 | M | Remove legacy root directories `client/`, `server/`, `shared/` + ESLint ban |
| TASK-012 | P1 | M | Raise CI coverage thresholds to lines=75, functions=70, branches=70 |
| TASK-013 | P1 | S | Replace `console.log` with `logger` in backend; enable ESLint `no-console` |
| TASK-014 | P1 | S | Document worker HPA queue-depth scaling in deployment guide |
| TASK-015 | P1 | M | Create `docs/operations/backup-and-recovery.md` with RTO/RPO targets |
| TASK-016 | P1 | M | Conduct and document first DR drill |
| TASK-017 | P1 | M | Baseline load tests for `/api/llm` and `/api/v1/cases` (k6/autocannon) |
| TASK-018 | P1 | M | Expand chaos tests: Postgres failure + Redis unavailability |
| TASK-019 | P1 | M | Write rollback scripts for release-critical migrations; add CI check |
| TASK-020 | P1 | S | Tune HPA `scaleDown.stabilizationWindowSeconds` from 300 → 150 |
| TASK-021 | P1 | M | Execute production launch checklist with evidence artifacts |
| TASK-022 | P1 | S | Update `DEPLOY.md` to reference canonical `ops/compose/` structure |
| TASK-023 | P1 | L | Expand OpenAPI spec to cover all public API endpoints |
| TASK-024 | P1 | M | Write 3 missing ADRs (agent fabric, CI security gate, service de-duplication) |
| TASK-025 | P1 | M | Define SLOs/SLIs + Prometheus alerting rules |
| TASK-026 | P2 | M | Feature flag transition: `beta_*` → `ga_*` |
| TASK-027 | P2 | M | WCAG accessibility + i18n completeness validation |

### Auth Hardening (from spec-auth-hardening.md)

| ID | Effort | Description |
|---|---|---|
| AUTH-R1 | S | Fix `AuthCallback` redirect: `/home` → `/dashboard` |
| AUTH-R2 | S | Delete 9 dead auth files |
| AUTH-R3 | S | Fix stale `AuthCallback.test.tsx` assertion (`/home` → `/dashboard`) |
| AUTH-R4 | M | Add `AuthContext` unit tests (login, signup, logout paths) |
| AUTH-R5 | M | Add `ProtectedRoute` and `OnboardingGate` unit tests |
| AUTH-R6 | M | Add frontend integration test: login → protected route → logout |
| AUTH-R7 | M | Align `computePermissions` role list with backend role model |

### Agent Architecture Gaps (from spec.md §5)

| ID | Effort | Description |
|---|---|---|
| AGENT-01 | S | `OpportunityAgent`: warn when domain pack context is disabled |
| AGENT-02 | S | Add `target-agent.json` policy file |
| AGENT-03 | S | Add `financial-modeling-agent.json` policy file; enforce confidence thresholds in `secureInvoke` |
| AGENT-04 | S | Add `narrative-agent.json` policy file |
| AGENT-05 | S | Add `realization-agent.json` policy file |
| AGENT-06 | S | Add `expansion-agent.json` policy file; add cycle detection guard on loop re-entry |
| AGENT-07 | M | `ComplianceAuditorAgent`: replace cross-workspace read with compliance evidence table query; redact financial figures from LLM prompt |

### User-Facing Features

| ID | Effort | Description |
|---|---|---|
| UX-01 | M | Surface `hallucination_check` result in SDUI (per-agent output) |
| UX-02 | L | User-facing audit log view (queryable by tenant admins) |
| UX-03 | M | Admin UI for agent kill switches and policy version visibility |
| UX-04 | L | Per-execution data lineage view ("what data did the agent use?") |
| UX-05 | L | Salesforce OAuth + opportunity fetch (US-008, deferred post-GA) |

### Open GitHub Issues (not yet covered above)

| Issue | Effort | Description |
|---|---|---|
| #1143 | M | Create GitHub Environments: `dev`, `staging`, `production`, `emergency-test-bypass` |
| #1144 | M | Agent fabric validation: FinancialModelingAgent architecture + memory persistence + KnowledgeFabricValidator integration test |

---

## Sprint Plan

### Sprint 35 — Foundation & Critical Fixes
**Goal:** Close all P0 blockers, fix the versioning bug, clean dead code, and harden auth. No enterprise demo should be blocked by these items.

**Security (3 items)**
- F-003 — Implement `ExternalAPIAdapter` (S)
- F-009 — Fix agent version override in `BaseAgent` constructor (S)
- F-014 — Fix SSE `setInterval` leak in compliance stream (S)

**Production Readiness — P0 (6 items)**
- TASK-001 — Fix `versioning.ts` unreachable code (S)
- TASK-002 — Add MFA startup assertion (S)
- TASK-003 — Document CORS wildcard rejection (S)
- TASK-004 — Document Docker Compose credential enforcement (S)
- TASK-005 — Verify frontend bundle service-role CI check (S)
- TASK-006 — Remove `c:/Users/` directory (S)

**Auth Hardening (4 items)**
- AUTH-R1 — Fix `AuthCallback` redirect (S)
- AUTH-R2 — Delete 9 dead auth files (S)
- AUTH-R3 — Fix stale `AuthCallback.test.tsx` (S)
- AUTH-R7 — Align `computePermissions` role list with backend (M)

**Agent Policy Files (5 items)**
- AGENT-01 — `OpportunityAgent` domain pack context warning (S)
- AGENT-02 — Add `target-agent.json` policy file (S)
- AGENT-03 — Add `financial-modeling-agent.json` + enforce confidence thresholds (S)
- AGENT-04 — Add `narrative-agent.json` policy file (S)
- AGENT-05 — Add `realization-agent.json` policy file (S)

**Sprint 35 total: ~18 items (mostly S effort)**

**Sprint 35 acceptance criteria:**
- [ ] `versioning.ts` returns HTTP 426 for unsupported versions
- [ ] `MFA_ENABLED` startup warning fires in production mode
- [ ] `c:/` directory removed from repo
- [ ] `AuthCallback` redirects to `/dashboard`
- [ ] 9 dead auth files deleted; build passes
- [ ] 5 agent policy files created with correct Together.ai model names
- [ ] `ExternalAPIAdapter` no longer a stub
- [ ] SSE interval cleared on client disconnect
- [ ] All agents report correct version from subclass definition

---

### Sprint 36 — Security Hardening & Code Quality
**Goal:** Resolve the highest-severity security findings, reduce TypeScript `any` debt, and remove legacy code.

**Security (5 items)**
- F-004 — Forward real `userId` from `LifecycleContext` in `secureInvoke` (S)
- F-006 — Replace SHA-1 with SHA-256 in `ComplianceControlStatusService` (S)
- F-007 — Update `default.json` and `integrity-agent.json` policy files with correct Together.ai model names (M)
- F-008 — Add access control gate to `crossReferenceMemory` and `ComplianceAuditorAgent` cross-workspace reads (M)
- F-012 — Enforce TTL on `MemorySystem` reads (M)

**Auth Hardening (3 items)**
- AUTH-R4 — Add `AuthContext` unit tests (M)
- AUTH-R5 — Add `ProtectedRoute` and `OnboardingGate` unit tests (M)
- AUTH-R6 — Add frontend integration test: login → protected route → logout (M)

**Code Quality (4 items)**
- TASK-006 — (carried if not done in S35)
- TASK-010 — De-duplicate `ValueTreeService` (S)
- TASK-011 — Remove legacy root directories + ESLint ban (M)
- TASK-013 — Replace `console.log` with `logger`; enable `no-console` (S)
- TASK-009 (partial) — TypeScript `any` reduction: backend target <400 (L, split across S36–S37)

**Agent Architecture (2 items)**
- AGENT-06 — Add `expansion-agent.json` + cycle detection guard (S)
- AGENT-07 — `ComplianceAuditorAgent` cross-workspace read replacement + financial data redaction (M)

**Sprint 36 total: ~15 items**

**Sprint 36 acceptance criteria:**
- [ ] Real `userId` forwarded in all LLM requests (no more `"system"`)
- [ ] SHA-1 replaced with SHA-256 in compliance service
- [ ] All 8 agent policy files exist with correct Together.ai model names
- [ ] Cross-workspace memory reads require explicit access control check
- [ ] `MemorySystem` TTL enforced on reads
- [ ] `AuthContext`, `ProtectedRoute`, `OnboardingGate` have unit tests
- [ ] Frontend login → protected route → logout integration test passes
- [ ] `ValueTreeService` root duplicate deleted
- [ ] Legacy `client/`, `server/`, `shared/` directories removed
- [ ] Zero `console.log` in `packages/backend/src`
- [ ] Backend `any` count < 400

---

### Sprint 37 — Governance, Observability & Resilience
**Goal:** Replace fabricated compliance scores with real telemetry, implement the agent audit trail, complete DSR coverage, and establish operational baselines.

**Security / Governance (4 items)**
- F-001 — Replace hash-derived compliance scores with real telemetry in `ComplianceControlStatusService` (L)
- F-002 — Implement `AuditLogger` in agent-fabric (wire to `AuditLogService`/`AuditTrailService`) (M)
- F-005 — Add TTL and durable alerting to emergency auth fallback (M)
- F-011 — Add 7 missing tables to DSR erasure `PII_TABLES` list (M)

**Code Quality (2 items)**
- TASK-009 (continued) — TypeScript `any` reduction: ValyntApp <200, sdui <150 (L)
- TASK-012 — Raise CI coverage thresholds to lines=75, functions=70, branches=70 (M)

**Infrastructure & Resilience (5 items)**
- TASK-007 — Un-skip E2E test `TEST-E2E-CRITICAL-003` (S)
- TASK-008 — Frontend tenant isolation audit + unit tests for `getBenchmarks`/`getOntologyStats` (M)
- TASK-018 — Expand chaos tests: Postgres + Redis failure (M)
- TASK-019 — Write rollback scripts for release-critical migrations + CI check (M)
- TASK-020 — Tune HPA `scaleDown.stabilizationWindowSeconds` 300 → 150 (S)

**Documentation & ADRs (3 items)**
- TASK-022 — Update `DEPLOY.md` canonical compose reference (S)
- TASK-024 — Write 3 missing ADRs (agent fabric, CI security gate, service de-duplication) (M)
- #1143 — Create GitHub Environments in repo settings (M)

**Sprint 37 total: ~14 items**

**Sprint 37 acceptance criteria:**
- [ ] `/compliance/control-status` returns real telemetry (not hash-derived values)
- [ ] Agent-level LLM invocations, memory writes, and veto decisions produce audit log entries
- [ ] Emergency auth fallback has TTL enforcement and durable alerting
- [ ] DSR erasure covers all 7 previously missing agent output tables
- [ ] ValyntApp `any` count < 200; sdui `any` count < 150
- [ ] CI coverage thresholds at 75/70/70
- [ ] `TEST-E2E-CRITICAL-003` runs and passes without skip
- [ ] Chaos tests cover Postgres and Redis failure modes
- [ ] All release-critical migrations have rollback scripts
- [ ] 3 new ADRs published in `docs/engineering/adr/`
- [ ] GitHub Environments created with correct protection rules

---

### Sprint 38 — Trust Layer, Operational Readiness & User-Facing Features
**Goal:** Surface agent transparency to users, complete operational documentation, establish load baselines, and deliver the first user-facing trust features.

**Security / Trust (2 items)**
- F-010 — Fix model cards: correct model names + real `prompt_contract_hash` computation (M)
- F-013 — Strengthen `AgentIdentity` with signed tokens or scoped permissions enforcement (L)

**User-Facing Features (3 items)**
- UX-01 — Surface `hallucination_check` in SDUI per-agent output (M)
- UX-02 — Tenant admin audit log view (queryable by org) (L)
- UX-03 — Admin UI for agent kill switches and policy version visibility (M)

**Infrastructure & Operations (5 items)**
- TASK-014 — Document worker HPA queue-depth scaling (S)
- TASK-015 — Create `docs/operations/backup-and-recovery.md` (M)
- TASK-016 — Conduct and document first DR drill (M)
- TASK-017 — Baseline load tests for critical endpoints (M)
- TASK-025 — Define SLOs/SLIs + Prometheus alerting rules (M)

**Documentation (2 items)**
- TASK-021 — Execute production launch checklist with evidence artifacts (M)
- TASK-023 — Expand OpenAPI spec to cover all public endpoints (L)

**Agent Fabric Validation (1 item)**
- #1144 — FinancialModelingAgent architecture decision + memory persistence validation + KnowledgeFabricValidator integration test (M)

**Sprint 38 total: ~13 items**

**Sprint 38 acceptance criteria:**
- [ ] Model cards reference correct Together.ai model names and real prompt hashes
- [ ] `AgentIdentity` permissions are enforced (not always empty)
- [ ] `hallucination_check` result visible to users in SDUI
- [ ] Tenant admins can query their audit log in the UI
- [ ] Admin UI shows agent kill switch state and active policy version per agent
- [ ] `docs/operations/backup-and-recovery.md` exists with RTO ≤4h, RPO ≤1h
- [ ] First DR drill completed and logged in `docs/operations/dr-drill-log.md`
- [ ] Load test baselines documented (p95 case creation ≤2s at 50 concurrent users)
- [ ] SLO/SLI document + at least one Prometheus burn-rate alert
- [ ] Production launch checklist fully executed with evidence
- [ ] OpenAPI spec covers all public endpoints and validates without errors

---

## Deferred (Post-Sprint 38)

| Item | Reason |
|---|---|
| UX-04 — Per-execution data lineage view | High effort; requires new data model |
| UX-05 — Salesforce OAuth + opportunity fetch | Explicitly deferred post-GA (US-008) |
| TASK-026 — Feature flag `beta_*` → `ga_*` transition | Requires production environment to be live |
| TASK-027 — WCAG accessibility + i18n validation | P2; no blocking dependency |

---

## Summary Table

| Sprint | Theme | Items | Key Outcomes |
|---|---|---|---|
| 35 | Foundation & Critical Fixes | ~18 | P0 bugs closed, auth hardened, agent policies complete |
| 36 | Security Hardening & Code Quality | ~15 | Real user IDs in LLM calls, SHA-1 removed, legacy code deleted, `any` backend <400 |
| 37 | Governance, Observability & Resilience | ~14 | Real compliance scores, agent audit trail live, DSR complete, chaos tests |
| 38 | Trust Layer & Operational Readiness | ~13 | Hallucination UX, audit log view, load baselines, launch checklist executed |

**Enterprise readiness gate:** All Sprint 35–38 P0/P1 items complete → platform ready for broad enterprise deployment.
