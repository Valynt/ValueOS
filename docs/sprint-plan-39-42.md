# Sprint Plan — Sprints 39–42
# ValueOS: Agent Trust, Memory Hardening, and Post-GA Expansion

**Baseline:** Sprint 38 complete (assumed). Current sprint: 39.  
**`any` counts (re-measured 2026-08-xx):** backend 171, ValyntApp 82, sdui 13.  
**All lifecycle stages:** ✅ full-stack slices complete (Stages 1–6).  
**All P0/P1 debt items:** resolved through Sprint 38.  
**ADRs 0010–0017:** published.  
**Operations docs:** `backup-and-recovery.md`, `dr-drill-log.md`, `load-test-baselines.md`, `slo-sli.md` all exist.

---

## Baseline State

### Complete (do not re-schedule)
- All 6 lifecycle stages wired end-to-end (Hypothesis → Model → Integrity → Narrative → Realization → Expansion)
- All 8 agent policy files in `policies/agents/` with correct Together.ai model names
- `ExternalAPIAdapter` implemented (F-003 resolved)
- `AuthCallback` redirects to `/dashboard` (AUTH-R1 resolved)
- MFA startup assertion in `server.ts` (TASK-002 resolved)
- `versioning.ts` returns HTTP 426 (TASK-001 resolved)
- Emergency auth fallback has TTL enforcement via `AUTH_FALLBACK_EMERGENCY_TTL_UNTIL` (F-005 resolved)
- `backup-and-recovery.md`, `dr-drill-log.md`, `slo-sli.md`, `load-test-baselines.md` exist
- ADRs 0015, 0016, 0017 published
- `any` counts: backend 171 (was 446 entering Sprint 33), ValyntApp 82, sdui 13

### Open entering Sprint 39

| ID | Severity | Status | Description |
|---|---|---|---|
| F-001 | Critical | Open | `ComplianceControlStatusService` returns hash-derived fake scores |
| F-002 | Critical | Open | `lib/agent-fabric/AuditLogger.ts` is an empty stub |
| F-004 | High | Open | `secureInvoke` hardcodes `userId: "system"` (BaseAgent.ts:243) |
| F-006 | High | Open | `ComplianceControlStatusService.scoreFor` uses SHA-1 |
| F-008 | High | Open | `crossReferenceMemory` uses `include_cross_workspace: true` with no access gate |
| F-010 | Medium | Open | Model cards have fake `prompt_contract_hash` values |
| F-011 | Medium | Open | DSR erasure `PII_TABLES` missing 7 agent output tables |
| F-012 | Medium | Open | `MemorySystem` TTL not enforced on reads |
| F-013 | Medium | Open | `AgentIdentity.permissions` always `[]` |
| UX-01 | — | Open | `hallucination_check` not surfaced in SDUI |
| UX-02 | — | Open | No tenant admin audit log view |
| UX-03 | — | Open | No admin UI for agent kill switches / policy version |
| UX-04 | — | Deferred | Per-execution data lineage view |
| UX-05 | — | Deferred | Salesforce OAuth + opportunity fetch (US-008) |
| TASK-009 | P1 | Ongoing | `any` reduction: backend <150, ValyntApp <50, sdui maintain 0 |
| TASK-023 | P1 | Open | OpenAPI spec covers only 49 of ~120+ public endpoints |
| #1144 | P1 | Open | FinancialModelingAgent architecture + memory persistence validation |
| MEM-01 | — | New | Memory permission classification and isolation (per data management standards) |
| MEM-02 | — | New | PII/secret redaction in debug views and agent logs |
| MEM-03 | — | New | FIDES-style context isolation: hide sensitive data from agent reasoning paths |

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

## Sprint 39 — Agent Integrity and Memory Hardening

**Objective:** Close the two critical security findings that undermine agent trustworthiness (fake compliance scores, empty audit trail) and enforce memory access controls.

**Dependency rationale:** F-001 and F-002 are the highest-severity open items. They must be resolved before Sprint 40's user-facing trust features can be meaningful — surfacing `hallucination_check` in the UI is hollow if the underlying audit trail is a stub.

### KR 1 — Replace hash-derived compliance scores (F-001)

`ComplianceControlStatusService.scoreFor()` derives all compliance metrics from a SHA-1 hash of `tenantId + seed`. This produces deterministic but fabricated numbers that change only when the tenant ID changes. Replace with real telemetry queries.

**Acceptance criteria:**
- `scoreFor()` removed; each metric reads from a real source:
  - `mfaCoverage` → query `auth.mfa_factors` count / `auth.users` count for the tenant
  - `encryptionCoverage` → constant 100 (AES-256-GCM enforced at infra layer; document the source)
  - `keyRotationHours` → read `crm_connections.token_key_version` last-rotated timestamp
  - `integrityFailures` → count `integrity_outputs` rows where `veto_count > 0` in last 30 days
- `/compliance/control-status` returns values that change when underlying data changes
- Unit test: mock Supabase responses → assert metric values match expected derivation
- `pnpm test` green

**Debt ref:** F-001, F-006 (SHA-1 in `scoreFor` removed as part of this change)

### KR 2 — Implement `AuditLogger` in agent-fabric (F-002)

`packages/backend/src/lib/agent-fabric/AuditLogger.ts` is an empty class. Agent LLM invocations, memory writes, and veto decisions produce no audit entries.

**Acceptance criteria:**
- `AuditLogger` delegates to `AuditLogService` (existing, in `services/security/`)
- Logs: `secureInvoke` call start/end (agent name, session ID, model, latency), memory store operations (table, tenant, key), veto decisions (agent, case ID, claim ID, reason)
- `BaseAgent` wires `AuditLogger` — no agent subclass changes required
- Audit entries include `tenantId` (per 2026-08-04 decision — new callers must supply it)
- Integration test: run `OpportunityAgent` in test harness → assert `audit_logs` rows exist with correct fields
- `pnpm test` green

**Debt ref:** F-002

### KR 3 — Enforce `MemorySystem` TTL on reads (F-012) and gate cross-workspace reads (F-008)

Two related memory access control gaps: (1) `MemorySystem` prunes expired entries only during `consolidate()`, not on reads — stale entries are returned between consolidation cycles. (2) `crossReferenceMemory` in `BaseAgent` calls `SupabaseMemoryBackend` with `include_cross_workspace: true` without verifying the caller has cross-workspace permission.

**Acceptance criteria:**
- `MemorySystem.get()` / `query()` filter out entries where `created_at + ttl_seconds < now` before returning
- `crossReferenceMemory` checks `this.organizationId` against a configurable allowlist before setting `include_cross_workspace: true`; defaults to `false` (tenant-scoped only) when no allowlist entry exists
- Unit tests: expired entry not returned on read; cross-workspace read blocked without allowlist entry
- `pnpm test` green

**Debt ref:** F-008, F-012 | **Memory standard:** Memory Hardening and Isolation

### KR 4 — PII and secret redaction in agent debug views (MEM-02)

Agent output logs and debug endpoints expose raw LLM responses that may contain PII or credentials extracted from documents. Structured log fields must be scrubbed before writing.

**Acceptance criteria:**
- `AuditLogger` (from KR 2) passes output through a `redactPii()` utility before logging
- `redactPii()` masks: SSN patterns, credit card numbers, email addresses in bulk, phone numbers, passport numbers — consistent with the PII detection rules in `.windsurf/rules/global.md`
- Financial figures in `ComplianceAuditorAgent` prompts are redacted before the LLM call (F-007 partial)
- Unit test: `redactPii()` masks each PII type; non-PII strings pass through unchanged
- `pnpm test` green

**Debt ref:** MEM-02, F-007 (partial)

### KR 5 — Test gate

- `pnpm test` green
- `pnpm run test:rls` green
- `bash scripts/test-agent-security.sh` green

---

## Sprint 40 — User-Facing Trust Features

**Objective:** Surface agent transparency to users — hallucination signals, audit history, and admin controls — so that enterprise buyers can verify the system's reasoning.

**Dependency rationale:** Sprint 39 must complete first. `AuditLogger` (KR 2) is the data source for UX-02. The `hallucination_check` field already exists in agent Zod schemas and hook responses; Sprint 40 wires it to UI.

### KR 1 — Surface `hallucination_check` in SDUI per-agent output (UX-01)

Each agent output card in the lifecycle canvas shows a trust indicator derived from `hallucination_check` and `hallucination_details`.

**Acceptance criteria:**
- New SDUI component `HallucinationBadge` registered in both `config/ui-registry.json` and `packages/sdui/src/registry.tsx`
- Badge renders: green (check passed), amber (check absent/unknown), red (check failed)
- `HypothesisStage`, `IntegrityStage`, `NarrativeStage`, `RealizationStage`, `ExpansionStage` render the badge when agent output includes `hallucination_check`
- Badge is read-only; clicking it shows a tooltip with `hallucination_details.grounding_score` if present
- Component test: renders correct color for each state
- `pnpm test` green

**Debt ref:** UX-01

### KR 2 — Tenant admin audit log view (UX-02)

Tenant admins can query their organization's audit log from the settings UI.

**Acceptance criteria:**
- `GET /api/v1/audit-logs` endpoint: tenant-scoped, paginated (cursor-based), filterable by `action`, `resource_type`, date range; requires `admin:audit` permission
- Frontend page `AuditLogPage` at `/settings/audit-log` with table: timestamp, actor, action, resource, details
- Route added to `SettingsLayout` as "Audit Log" tab (admin-only)
- Empty state when no entries exist
- Cross-tenant read returns 403
- `pnpm test` green; `pnpm run test:rls` green

**Debt ref:** UX-02

### KR 3 — Admin UI for agent kill switches and policy version (UX-03)

Admins can see which agents are active, their current policy version, and toggle a kill switch per agent.

**Acceptance criteria:**
- `GET /api/v1/admin/agents` returns: agent name, policy version (from `AgentPolicyService`), kill switch state (from a new `agent_kill_switches` table or Redis key)
- `POST /api/v1/admin/agents/:agentName/kill-switch` toggles the switch; requires `admin:agents` permission
- `BaseAgent.secureInvoke()` checks kill switch before executing; returns a structured error if switched off
- Frontend page `AgentAdminPage` at `/admin/agents` shows the list with toggle controls
- `pnpm test` green

**Debt ref:** UX-03

### KR 4 — Forward real `userId` in `secureInvoke` (F-004)

`BaseAgent.secureInvoke()` hardcodes `userId: "system"` (line 243). The `LifecycleContext` carries the real user ID.

**Acceptance criteria:**
- `secureInvoke` reads `userId` from `context.userId` when available; falls back to `"system"` only when context is absent (with a `warn` log)
- All LLM audit entries produced by `AuditLogger` (Sprint 39 KR 2) include the real user ID
- Unit test: context with `userId` → audit entry contains that ID; context without → `"system"` with warn log
- `pnpm test` green

**Debt ref:** F-004

### KR 5 — Test gate

- `pnpm test` green
- `pnpm run test:rls` green (new `audit_logs` endpoint + `agent_kill_switches` table)
- `bash scripts/test-agent-security.sh` green

---

## Sprint 41 — GDPR Completeness, Model Card Integrity, and `any` Elimination

**Objective:** Close the remaining GDPR Art. 17 gap, fix fabricated model card data, strengthen `AgentIdentity`, and drive `any` counts to near-zero in production files.

**Dependency rationale:** F-011 (DSR gap) is a compliance blocker for enterprise customers in regulated industries. F-010 and F-013 are medium-severity but affect enterprise trust reviews. `any` reduction is ongoing; Sprint 41 targets the remaining backend and ValyntApp counts.

### KR 1 — DSR erasure covers all agent output tables (F-011)

`PII_TABLES` in `dataSubjectRequests.ts` lists 6 tables. Seven agent output tables are missing: `hypothesis_outputs`, `integrity_outputs`, `narrative_drafts`, `realization_reports`, `expansion_opportunities`, `value_tree_nodes`, `financial_model_snapshots`.

**Acceptance criteria:**
- All 7 tables added to `PII_TABLES` with correct `userColumn` (use `organization_id` as the scoping key; join to `value_cases.created_by` for user-level erasure)
- DSR erasure test: create agent outputs for a user → trigger erasure → assert rows deleted or anonymized
- `pnpm test` green

**Debt ref:** F-011

### KR 2 — Real `prompt_contract_hash` in model cards (F-010)

`ModelCardService` hardcodes hex strings as `prompt_contract_hash`. These should be SHA-256 hashes of the actual prompt template content.

**Acceptance criteria:**
- `ModelCardService` computes `prompt_contract_hash` as `sha256(promptTemplate)` at startup, where `promptTemplate` is read from the agent's Handlebars template file
- Hash changes when the template changes (verified by a test that modifies the template and asserts a different hash)
- Model names in all model cards reference valid Together.ai model identifiers (matching `policies/agents/*.json`)
- `pnpm test` green

**Debt ref:** F-010

### KR 3 — `AgentIdentity` permissions enforced (F-013)

`AgentIdentity` always initializes `permissions: []`. Agents that should have restricted tool access (e.g. `ComplianceAuditorAgent` should not call external APIs) have no enforcement.

**Acceptance criteria:**
- `AgentIdentity` permissions populated from the agent's policy file (`allowedTools` → mapped to permission strings)
- `BaseAgent` checks `this.identity.permissions` before calling a tool; throws `PermissionDeniedError` if the tool is not in the allowed list
- `ComplianceAuditorAgent` policy file lists only `document_lookup` (no `web_search`)
- Unit test: agent with restricted permissions cannot invoke a disallowed tool
- `pnpm test` green

**Debt ref:** F-013

### KR 4 — `any` reduction: backend <150 → <100, ValyntApp <82 → <50 (TASK-009)

Current measured counts: backend 171, ValyntApp 82, sdui 13.

**Acceptance criteria:**
- Backend production `any` count < 100 (re-measured with grep at PR merge)
- ValyntApp production `any` count < 50
- sdui count remains ≤ 13
- Priority files for backend: `services/post-v1/RealizationFeedbackLoop.ts` (7), `services/auth/SettingsService.ts` (7), `services/AssumptionService.ts` (7), `types/sdui-integration.ts` (6), `services/tenant/TenantProvisioning.ts` (6)
- No new `any` introduced in any file touched this sprint
- `pnpm run typecheck` passes

**Debt ref:** TASK-009

### KR 5 — FIDES-style context isolation for sensitive agent reasoning (MEM-03)

Agents that process financial or compliance data must not receive raw PII or credentials in their reasoning context. Implement a context sanitization layer.

**Acceptance criteria:**
- `ContextStore` (runtime service) applies a `sanitizeForAgent()` pass before injecting context into agent prompts
- `sanitizeForAgent()` removes fields tagged `pii: true` or `secret: true` in the domain schema
- `ComplianceAuditorAgent` and `FinancialModelingAgent` receive sanitized context; raw PII fields are replaced with `[REDACTED]` tokens
- Unit test: context with PII fields → sanitized context has `[REDACTED]`; non-PII fields pass through
- `pnpm test` green

**Debt ref:** MEM-03 | **Memory standard:** FIDES Planning

### KR 6 — Test gate

- `pnpm test` green
- `pnpm run test:rls` green
- `bash scripts/test-agent-security.sh` green

---

## Sprint 42 — OpenAPI Completeness, Salesforce OAuth, and Post-GA Expansion

**Objective:** Complete the public API contract, deliver the deferred Salesforce integration, and establish the data lineage foundation for enterprise buyers.

**Dependency rationale:** OpenAPI completeness (TASK-023) is a prerequisite for SDK generation and partner integrations. Salesforce OAuth (UX-05) was explicitly deferred post-GA and is now unblocked. Data lineage (UX-04) requires the audit trail from Sprint 39 and the sanitized context from Sprint 41.

### KR 1 — OpenAPI spec covers all public endpoints (TASK-023)

Current `packages/backend/openapi.yaml` documents 49 paths. The backend has ~120+ mounted routes.

**Acceptance criteria:**
- All routes in `server.ts` router mounts have corresponding OpenAPI path entries
- Each path documents: request body schema (Zod → JSON Schema), response schemas (200, 400, 401, 403, 404, 500), auth requirement (`bearerAuth`)
- `scripts/openapi.yaml` and `packages/backend/openapi.yaml` are reconciled into one canonical file
- CI check: `openapi-validator` (or equivalent) runs on every PR and fails on schema errors
- `pnpm test` green

**Debt ref:** TASK-023

### KR 2 — Salesforce OAuth + opportunity fetch (UX-05 / US-008)

Salesforce OAuth was deferred post-GA. `SalesforceAdapter` exists (`packages/integrations/salesforce/SalesforceAdapter.ts`) but the OAuth flow and opportunity fetch UI are not wired.

**Acceptance criteria:**
- `GET /api/crm/salesforce/auth` initiates OAuth2 PKCE flow; `GET /api/crm/salesforce/callback` exchanges code for tokens and stores via `CrmConnectionService`
- `GET /api/crm/salesforce/opportunities` returns paginated opportunity list scoped to the tenant's connected account
- Frontend: Salesforce appears as a selectable CRM in the "New Case" flow alongside HubSpot
- Token refresh handled transparently by `SalesforceAdapter`
- Integration test: mock Salesforce OAuth server → assert token stored in `crm_connections`
- `pnpm run test:rls` green (crm_connections RLS)

**Debt ref:** UX-05, US-008

### KR 3 — Per-execution data lineage view foundation (UX-04)

Each agent execution should expose: which memory entries were read, which tools were called, which DB rows were written. This sprint delivers the data model and backend API; the full UI is Sprint 43+.

**Acceptance criteria:**
- New table `agent_execution_lineage` (`id`, `session_id`, `agent_name`, `organization_id`, `memory_reads jsonb`, `tool_calls jsonb`, `db_writes jsonb`, `created_at`) with RLS
- Migration file + rollback file
- `BaseAgent` writes a lineage row after each `secureInvoke` call (non-blocking; failure logged, not thrown)
- `GET /api/v1/cases/:caseId/lineage` returns lineage rows for all agent executions on the case, tenant-scoped
- `pnpm run test:rls` green for new table

**Debt ref:** UX-04 (foundation only)

### KR 4 — FinancialModelingAgent architecture validation (#1144)

Validate that `FinancialModelingAgent` correctly uses the two-layer memory architecture (ADR-0013) and that its output persists through `SupabaseMemoryBackend`.

**Acceptance criteria:**
- Integration test: invoke `FinancialModelingAgent` → assert `financial_model_snapshots` row created → assert `semantic_memory` entry exists with correct `tenant_id` metadata
- `KnowledgeFabricValidator` (if it exists) runs against `FinancialModelingAgent` output and passes
- Any architecture gaps found are documented as new debt items in `debt.md`
- `pnpm test` green

**Debt ref:** #1144

### KR 5 — Test gate

- `pnpm test` green
- `pnpm run test:rls` green (new `agent_execution_lineage` table + Salesforce CRM paths)
- `bash scripts/test-agent-security.sh` green
- OpenAPI CI check passes

---

## Deferred (Post-Sprint 42)

| Item | Reason |
|---|---|
| UX-04 full UI — per-execution data lineage view | Data model delivered Sprint 42; UI requires design work |
| TASK-026 — Feature flag `beta_*` → `ga_*` transition | Requires production environment live for ≥1 month |
| TASK-027 — WCAG accessibility + i18n validation | P2; no blocking dependency |
| ServiceNow adapter | Explicitly deferred post-GA (US-008) |
| Cross-case learning / expansion signal compounding | Requires durable semantic memory confirmed live at scale |
| SOC 2 evidence collection automation | Requires complete, stable product; post-Sprint 42 |
| `AgentIdentity` cryptographic binding (full F-013) | Sprint 41 delivers permission enforcement; crypto binding is a follow-on |

---

## Summary Table

| Sprint | Objective | Key Outcomes |
|---|---|---|
| 39 | Agent Integrity and Memory Hardening | Real compliance scores, agent audit trail live, memory TTL enforced, PII redaction in logs |
| 40 | User-Facing Trust Features | Hallucination badge in SDUI, tenant audit log view, agent kill switch admin UI, real userId in LLM calls |
| 41 | GDPR Completeness, Model Cards, `any` Elimination | DSR covers all agent tables, real prompt hashes, AgentIdentity permissions enforced, backend any <100 |
| 42 | OpenAPI, Salesforce, Data Lineage Foundation | Full API contract documented, Salesforce OAuth wired, lineage data model live, FinancialModelingAgent validated |
