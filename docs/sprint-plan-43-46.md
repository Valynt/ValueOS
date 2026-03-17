# Sprint Plan — Sprints 43–46
# ValueOS: `any` Elimination, API Contract Completeness, and Post-GA Expansion

**Baseline:** Sprint 42 complete (assumed).
**Current sprint:** 43
**Team size:** 4+ engineers (~12–18 items per sprint)
**Sequencing principle:** `any` elimination by package (smallest first), then API contract hardening, then deferred integrations.

---

## Verified Baseline State

### Re-measured `any` counts (grep `:\s*any\b|as any\b|<any>`, production files only, 2026-08-xx)

| Package | Count |
|---|---:|
| `packages/backend` | 153 |
| `apps/ValyntApp` | 58 |
| `packages/sdui` | 37 |
| `apps/VOSAcademy` | 66 |
| `packages/shared` | 26 |
| `packages/components` | 0 |
| `packages/mcp` | 0 |
| `packages/infra` | — (verify before sprint) |

### Complete (do not re-schedule)

All items verified against the codebase:

- All 6 lifecycle stages wired end-to-end (Stages 1–6) — ✅ traceability rows
- `AuditLogger` implemented and wired into `BaseAgent` — F-002 resolved
- Real `userId` forwarded in `secureInvoke` — F-004 resolved
- `MemorySystem` TTL enforced on reads — F-012 resolved
- Cross-workspace memory gating via `CROSS_WORKSPACE_MEMORY_ALLOWLIST` — F-008 resolved
- `ComplianceControlStatusService` uses real telemetry (mfaCoverage, keyRotationHours, integrityFailures) — F-001, F-006 resolved
- PII redaction in `AuditLogger` via `redactSensitiveText` — MEM-02 resolved
- `GET /api/v1/audit-logs` endpoint + `AuditLogPage` in settings — UX-02 resolved
- `AgentAdminPage` at `/admin/agents` + kill switch toggle — UX-03 resolved
- `HallucinationBadge` SDUI component registered in both `registry.tsx` and `ui-registry.json` — UX-01 resolved
- DSR erasure covers all 7 agent output tables via `dataAssetInventoryRegistry.ts` — F-011 resolved
- `AgentIdentity.permissions` populated from policy `allowedTools` — F-013 resolved
- FIDES-style `sanitizeForAgent()` in `ContextStore` — MEM-03 resolved
- `ModelCardService` computes `prompt_contract_hash` as `sha256(policyFileContent)` — F-010 resolved
- `packages/components` — 0 `any` usages
- `packages/mcp` — 0 `any` usages

### Open entering Sprint 43

| ID | Severity | Description | Verified |
|---|---|---|---|
| DEBT-ANY-S43 | P1 | `packages/shared`: 26 `any` usages (target: 0) | grep count |
| DEBT-ANY-S43b | P1 | `packages/sdui`: 37 `any` usages (target: 0) | grep count |
| DEBT-ANY-S44 | P1 | `apps/VOSAcademy`: 66 `any` usages (target: 0) | grep count |
| DEBT-ANY-S45 | P1 | `apps/ValyntApp`: 58 `any` usages (target: <20) | grep count |
| DEBT-ANY-S46 | P1 | `packages/backend`: 153 `any` usages (target: <50) | grep count |
| TASK-023 | P1 | OpenAPI spec covers 51 of ~120+ public endpoints | path count |
| UX-05 | Deferred | Salesforce OAuth + opportunity fetch (US-008) | no impl found |
| #1144 | P1 | `FinancialModelingAgent` architecture + memory persistence integration test | test exists but coverage gap |
| LINEAGE | New | `agent_execution_lineage` table + API (UX-04 foundation) — no migration found | grep confirms absent |

---

## Cross-Sprint Invariants

Every PR across all sprints must satisfy these rules from `AGENTS.md`:

| Rule | Enforcement |
|---|---|
| Every DB query includes `organization_id` or `tenant_id` | Code review + `pnpm run test:rls` |
| All LLM calls via `this.secureInvoke()` — never `llmGateway.complete()` directly | Code review |
| `service_role` only in AuthService, tenant provisioning, cron jobs | Code review |
| No cross-tenant data transfer | Code review |
| No `(req as any)` casts — extend `express.d.ts` instead | ESLint |
| No new `any` introduced | ESLint + grep gate |
| New tenant-scoped tables require RLS test before merge | ADR-0016 |
| New agents must pass agent security suite | `scripts/test-agent-security.sh` |

---

## Sequencing Rationale

1. **Smallest packages first.** `packages/shared` (26) and `packages/sdui` (37) are the lowest-cost eliminations and set the ratchet baseline for larger packages. Completing them in Sprint 43 locks in zero-`any` status before touching `ValyntApp` or `backend`.
2. **`VOSAcademy` before `ValyntApp`.** `VOSAcademy` (66) is isolated from the main product path; its `any` debt can be cleared without risk to the value-case workflow. `ValyntApp` (58) touches live user flows and requires more care.
3. **`backend` last.** At 153 usages, `packages/backend` is the largest remaining target. It is sequenced last because it carries the highest regression risk and benefits from the ratchet discipline established in earlier sprints.
4. **OpenAPI expansion in Sprint 45.** API contract completeness is a prerequisite for Salesforce OAuth (Sprint 46) — the Salesforce adapter must be documented before it is wired.
5. **Salesforce last.** US-008 Salesforce OAuth is the only remaining deferred user story. It depends on a stable CRM connection layer (already in place) and a documented API contract.

---

## Sprint 43 — `any` Elimination: `packages/shared` and `packages/sdui`

**Objective:** Drive `packages/shared` and `packages/sdui` to zero `any` usages, locking in the ratchet baseline for the two smallest remaining packages.

**Dependency rationale:** These two packages are imported by `ValyntApp`, `backend`, and `VOSAcademy`. Eliminating `any` here first means downstream packages inherit clean types, reducing the effort required in Sprints 44–46. `packages/shared` contains the canonical domain model — any `any` there propagates to every agent and repository.

### KR 1 — `packages/shared` reaches 0 `any` usages (DEBT-ANY-S43)

26 usages remain, concentrated in `packages/shared/src/lib/SemanticMemory.ts` (6 usages) and scattered across config and schema files.

**Acceptance criteria:**
- `grep -rn ":\s*any\b\|as any\b\|<any>" packages/shared/src --include="*.ts" --include="*.tsx" | grep -v "\.d\.ts\|\.test\.\|\.spec\."` returns 0 lines
- All replacements use `unknown` + type guards, or specific Zod-inferred types
- `pnpm run check` green (no new type errors introduced)
- `pnpm test` green

**Debt ref:** DEBT-ANY-BURNDOWN (S43-44 target: `packages/shared` -54 → 0)

### KR 2 — `packages/sdui` reaches 0 `any` usages (DEBT-ANY-S43b)

37 usages remain. SDUI components are the rendering layer for all lifecycle stage outputs — `any` here bypasses prop validation and silently breaks the SDUI registry contract.

**Acceptance criteria:**
- `grep -rn ":\s*any\b\|as any\b\|<any>" packages/sdui/src --include="*.ts" --include="*.tsx" | grep -v "\.d\.ts\|\.test\.\|\.spec\."` returns 0 lines
- SDUI component prop interfaces use specific types or `Record<string, unknown>` with type guards
- Both `config/ui-registry.json` and `packages/sdui/src/registry.tsx` remain consistent (no new components added without dual registration)
- `pnpm run check` green
- `pnpm test` green

**Debt ref:** DEBT-ANY-BURNDOWN (S43-44 target: `packages/components` already 0; `packages/sdui` reduction)

### KR 3 — Ratchet baseline updated and CI gate tightened

After KR 1 and KR 2 land, the `any` ratchet script must be updated to reflect the new zero baselines so future PRs cannot reintroduce `any` in these packages.

**Acceptance criteria:**
- `scripts/check-any-count.sh` updated with new per-package baselines: `packages/shared=0`, `packages/sdui=0`
- CI fails if either package exceeds 0 after this sprint
- `pnpm test` green

**Debt ref:** DEBT-ANY-BURNDOWN

### KR 4 — Test gate

- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run check` green (typecheck across all packages)

---

## Sprint 44 — `any` Elimination: `apps/VOSAcademy`

**Objective:** Drive `apps/VOSAcademy` to 0 `any` usages. VOSAcademy is isolated from the main value-case workflow, making it the safest large-package target.

**Dependency rationale:** Sprint 43 must complete first — `VOSAcademy` imports from `packages/shared`, and clean shared types reduce the substitution work here. VOSAcademy's 66 usages are deferred post-GA in the original burn-down plan; Sprint 44 closes that deferral.

### KR 1 — `apps/VOSAcademy` reaches 0 `any` usages (DEBT-ANY-S44)

66 usages remain across content loaders, API client calls, and component props.

**Acceptance criteria:**
- `grep -rn ":\s*any\b\|as any\b\|<any>" apps/VOSAcademy/src --include="*.ts" --include="*.tsx" | grep -v "\.d\.ts\|\.test\.\|\.spec\."` returns 0 lines
- Content loader responses validated with Zod schemas (already present for `loadContentFromJson` and `loadContentFromApi`); remaining `any` in response handling replaced with inferred Zod types
- `pnpm run check` green
- `pnpm test` green

**Debt ref:** DEBT-ANY-BURNDOWN (S45-46 target: `apps/VOSAcademy` -81 → 0)

### KR 2 — `FinancialModelingAgent` architecture validation (#1144)

`FinancialModelingAgent` has unit tests and a persistence test, but no integration test that asserts both `financial_model_snapshots` DB persistence and `semantic_memory` entry with correct `tenant_id` in a single end-to-end run.

**Acceptance criteria:**
- Integration test in `packages/backend/src/lib/agent-fabric/agents/__tests__/FinancialModelingAgent.integration.test.ts`:
  - Invokes `FinancialModelingAgent.execute()` with a real `LifecycleContext` (mocked LLM, real repository)
  - Asserts `financial_model_snapshots` row created with correct `case_id` and `organization_id`
  - Asserts `semantic_memory` entry exists with `tenant_id === organizationId`
  - Asserts cross-tenant read returns empty (tenant isolation)
- Any gaps found during test authoring documented as new debt items in `debt.md`
- `pnpm test` green

**Debt ref:** #1144

### KR 3 — Ratchet baseline updated

**Acceptance criteria:**
- `scripts/check-any-count.sh` updated: `apps/VOSAcademy=0`
- CI fails if `VOSAcademy` exceeds 0 after this sprint
- `pnpm test` green

### KR 4 — Test gate

- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run check` green

---

## Sprint 45 — `any` Elimination: `apps/ValyntApp` + OpenAPI Expansion

**Objective:** Drive `apps/ValyntApp` below 20 `any` usages and expand the OpenAPI spec to cover all value-case and agent endpoints.

**Dependency rationale:** `ValyntApp` (58 usages) touches live user flows — hooks, stage components, admin pages. Reducing to <20 rather than 0 in this sprint is intentional: the remaining usages are likely in complex event handler types and third-party integration shims that require more investigation. The OpenAPI expansion is sequenced here because it is a prerequisite for Salesforce OAuth documentation in Sprint 46.

### KR 1 — `apps/ValyntApp` `any` count below 20 (DEBT-ANY-S45)

58 usages remain. Priority targets: hooks (`useHypothesis`, `useExpansion`, `useIntegrity`, `useRealization`, `useNarrative` — all have `hallucination_check: boolean | null` typed but surrounding response shapes may use `any`), admin pages, and API client call sites.

**Acceptance criteria:**
- `grep -rn ":\s*any\b\|as any\b\|<any>" apps/ValyntApp/src --include="*.ts" --include="*.tsx" | grep -v "\.d\.ts\|\.test\.\|\.spec\."` returns ≤20 lines
- All hook response types use Zod-inferred or explicit interfaces — no `any` in hook return shapes
- `pnpm run check` green
- `pnpm test` green

**Debt ref:** DEBT-ANY-BURNDOWN (S55-60 target: `apps/ValyntApp` -251 → 0; this sprint closes the remaining 58)

### KR 2 — OpenAPI spec covers all value-case and agent endpoints (TASK-023, partial)

The spec currently covers 51 paths. The value-case router (`/api/v1/value-cases/*`, `/api/v1/cases/*`) and agent invoke endpoints (`/api/agents/*`) are the highest-traffic paths and the most likely to be consumed by external integrators.

**Acceptance criteria:**
- All routes in `packages/backend/src/api/valueCases/` have corresponding OpenAPI path entries with request body and response schemas
- All routes in `packages/backend/src/api/agents.ts` have corresponding OpenAPI path entries
- All commitment sub-resource endpoints (`/api/v1/value-commitments/*`) documented
- Path count in `openapi.yaml` increases from 51 to ≥80
- `openapi-validator` (or equivalent) passes in CI — no schema errors
- `pnpm test` green

**Debt ref:** TASK-023

### KR 3 — `agent_execution_lineage` table + API (LINEAGE / UX-04 foundation)

No migration for `agent_execution_lineage` exists. This table is the data source for the per-execution lineage view (UX-04) and is needed before the UI can be built.

**Acceptance criteria:**
- Migration: `agent_execution_lineage` (`id uuid`, `session_id uuid`, `agent_name text`, `organization_id uuid NOT NULL`, `memory_reads jsonb`, `tool_calls jsonb`, `db_writes jsonb`, `created_at timestamptz`) with RLS (tenant-scoped SELECT/INSERT; service_role full access) + rollback file
- `BaseAgent` writes a lineage row after each `secureInvoke` call (non-blocking — failure must not propagate to the agent's main execution path)
- `GET /api/v1/cases/:caseId/lineage` returns tenant-scoped lineage rows, paginated
- `pnpm run test:rls` green for new table

**Debt ref:** LINEAGE (UX-04 foundation)

### KR 4 — Test gate

- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run check` green

---

## Sprint 46 — `packages/backend` `any` Reduction + Salesforce OAuth

**Objective:** Drive `packages/backend` below 50 `any` usages and deliver Salesforce OAuth + opportunity fetch, closing the last deferred user story (US-008).

**Dependency rationale:** `packages/backend` (153 usages) is the largest remaining target. The OpenAPI spec from Sprint 45 must be in place before Salesforce endpoints are added — new routes must be documented at the time of creation, not retroactively. The Salesforce adapter already exists (`SalesforceAdapter extends EnterpriseAdapter`); this sprint wires the OAuth flow and opportunity fetch endpoint.

### KR 1 — `packages/backend` `any` count below 50 (DEBT-ANY-S46)

153 usages remain. Priority targets: service files in `packages/backend/src/services/`, API route handlers, and any remaining repository query result types.

**Acceptance criteria:**
- `grep -rn ":\s*any\b\|as any\b\|<any>" packages/backend/src --include="*.ts" --include="*.tsx" | grep -v "\.d\.ts\|\.test\.\|\.spec\."` returns ≤50 lines
- No `(req as any)` casts — all new properties added to `packages/backend/src/types/express.d.ts`
- `pnpm run check` green
- `pnpm test` green

**Debt ref:** DEBT-ANY-BURNDOWN (S61-72 target: `packages/backend` -647 → <100; this sprint closes the remaining 153 to <50)

### KR 2 — Salesforce OAuth + opportunity fetch (UX-05, US-008)

`SalesforceAdapter` exists but the OAuth2 PKCE flow is not wired and no opportunity fetch endpoint exists. HubSpot is the only active CRM path.

**Acceptance criteria:**
- OAuth2 PKCE flow wired: `GET /api/crm/salesforce/auth` initiates, `GET /api/crm/salesforce/callback` exchanges code for tokens, tokens stored via `CrmConnectionService` (AES-256-GCM, same pattern as HubSpot)
- `GET /api/crm/salesforce/opportunities` returns paginated, tenant-scoped opportunity list from Salesforce API
- Salesforce selectable in the \"New Case\" flow alongside HubSpot (frontend `CRMSelector` component updated)
- Token refresh handled transparently via `SalesforceAdapter`
- OpenAPI spec updated with Salesforce OAuth and opportunity endpoints
- `pnpm run test:rls` green (new CRM connection rows are tenant-scoped)
- `pnpm test` green

**Debt ref:** UX-05, US-008

### KR 3 — OpenAPI spec covers all public endpoints (TASK-023, completion)

Sprint 45 brought coverage to ≥80 paths. Sprint 46 closes the remaining gap: admin endpoints, integration endpoints, tenant management, and the new Salesforce routes.

**Acceptance criteria:**
- All routes in `server.ts` have corresponding OpenAPI path entries
- Path count ≥110 (covering all mounted routers)
- CI `openapi-validator` check passes
- `pnpm test` green

**Debt ref:** TASK-023

### KR 4 — Ratchet baseline updated for all packages

**Acceptance criteria:**
- `scripts/check-any-count.sh` updated with final baselines: `packages/backend≤50`, `apps/ValyntApp≤20`
- CI enforces these caps on every subsequent PR
- `pnpm test` green

### KR 5 — Test gate

- `pnpm test` green
- `pnpm run test:rls` green
- `bash scripts/test-agent-security.sh` green
- `pnpm run check` green

---

## Deferred Items (outside this planning horizon)

These items are explicitly excluded from Sprints 43–46:

| Item | Reason for deferral |
|---|---|
| `apps/ValyntApp` `any` count → 0 (remaining ≤20) | Requires investigation of complex event handler types; scheduled post-Sprint 46 |
| `packages/backend` `any` count → 0 (remaining ≤50) | Requires systematic audit of service layer; scheduled post-Sprint 46 |
| Per-execution data lineage UI (UX-04 full) | Foundation table lands Sprint 45; UI requires a full sprint after data accumulates |
| WCAG accessibility + i18n completeness (TASK-027) | No traceability row; requires dedicated accessibility sprint |
| Feature flag transition `beta_*` → `ga_*` (TASK-026) | Requires product sign-off on GA feature set |
| SOC 2 evidence collection | Requires complete, stable product; post-GA |
| Performance SLO enforcement (p95/p99 budgets) | Load test baselines exist; enforcement tooling not yet wired |
| Multi-provider LLM support (Anthropic, OpenAI, Gemini) | `LLMGateway` only implements `together`; architectural decision required before adding providers |
| `packages/infra` `any` count | Verify count before scheduling; may already be 0 |

---

## Sprint Success Statements

| Sprint | Success statement |
|---|---|
| 43 | `packages/shared` and `packages/sdui` report 0 `any` usages; CI ratchet prevents regression. |
| 44 | `apps/VOSAcademy` reports 0 `any` usages; `FinancialModelingAgent` integration test proves DB + memory persistence in a single run. |
| 45 | `apps/ValyntApp` is below 20 `any` usages; OpenAPI spec covers all value-case and agent endpoints; `agent_execution_lineage` table is live with RLS. |
| 46 | `packages/backend` is below 50 `any` usages; Salesforce OAuth is wired end-to-end; OpenAPI spec covers all public endpoints; ratchet baselines locked. |
