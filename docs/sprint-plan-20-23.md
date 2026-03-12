# Sprint Plan — Sprints 20–23: Product Completeness and Platform Hardening

**Author:** Ona (AI Engineering Agent)
**Date:** 2026-06-10
**Baseline:** Post-Sprint 19 (billing E2E complete; data observability foundation live; six lifecycle stages partially real)

---

## Baseline

### Current sprint: 20 (first sprint in this horizon)

### What is complete (✅ full traceability)
- Stage 1 Hypothesis — full stack slice live (OpportunityAgent → `hypothesis_outputs` → API → `useHypothesisOutput` → `HypothesisStage`)
- Stage 2 Model — full stack slice live (TargetAgent + FinancialModelingAgent → `value_tree_nodes` + `financial_model_snapshots` → API → `useValueTree` + `useModelSnapshot` → `ModelStage`)
- Stage 3 Integrity — full stack slice live (IntegrityAgent → `integrity_outputs` → API → `useIntegrityOutput` → `IntegrityStage`)
- Six runtime services wired: DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine
- Billing backend complete (Phases 0–2): subscription lifecycle, entitlements, invoice math, Stripe webhooks, usage aggregation, enforcement middleware
- RLS on all tenant tables; `pnpm run test:rls` suite wired
- AuditLogger append-only; `agent_audit_log` table live
- `valueCasesRouter` mounted in `server.ts` (resolved in Sprint 15)
- Data observability foundation: `data-asset-inventory.md`, freshness/volume monitoring, BullMQ queue metrics, schema drift detection, lineage registry, incident runbooks, SecurityMonitor alert channels
- Billing frontend wired: `useSubscription`, `useUsageSummary`, `useInvoices`, usage ledger endpoint, metering on agent/tool paths, enforcement middleware applied, invoice generation job, self-serve plan/payment controls, reconciliation export, custom pricing per tenant

### What is broken / P0 (must appear in Sprint 20)
- **`valueCasesRouter` mount** — confirmed gap in traceability.md Stage 1; all `/api/v1/value-cases/...` return 404. Fix: import and mount in `server.ts`. *(Note: listed as resolved in sprint-plan-15-18 KR 15-1 — verify in code before Sprint 20 begins; if still open, KR 20-1 resolves it.)*

### What is incomplete / P1 (sequenced across sprints)
- **DEBT-004 / #1345** — `RealizationStage` renders hardcoded Acme Corp demo data; no `realization_outputs` table, no repository, no endpoint
- **DEBT-005 / #1346** — `NarrativeAgent.ts` does not exist; `NarrativeStage` has no backend
- **DEBT-006 / #1347** — `ValueCaseCanvas` hardcodes case title ("Acme Corp — Enterprise Platform Migration")
- **DEBT-007 / #1348** — `ValueCommitmentTrackingService` has 12+ TODO stubs returning mock data
- **DEBT-009** — `expansion_outputs` table and `ExpansionOutputRepository` missing; Stage 6 has no persistence
- Stage 4 Narrative — agent, DB table, repository, API endpoints, frontend hook all ❌
- Stage 5 Realization — DB table, repository, API endpoint, frontend hook all ❌ (agent exists)
- Stage 6 Expansion — DB table, repository, API endpoint, frontend hook all ❌ (agent exists)
- `ValueCaseCanvas` title hardcoded (DEBT-006)
- US-005 (executive narrative) ❌; US-006 (realization tracking) ❌

### What is deferred (post-Sprint 23)
- DEBT-008 — ServiceNow, Slack, SharePoint integrations (product decision pending)
- DEBT-010 — SecurityMonitor alert channels (resolved in Sprint 16 per sprint-plan-15-18)
- DEBT-011 — SandboxedExecutor E2B SDK (product decision pending)
- DEBT-012 — VOSAcademy content loader (content strategy pending)
- PPTX export
- Kafka rollout
- Grafana alerting rules wired to incident runbooks
- `DeviceFingerprintService` GeoIP / threat intelligence
- `EnhancedParallelExecutor` progress-to-UI via WebSocket
- Checklist §25 maturity review — quarterly observability gap review
- US-007 tenant onboarding UI and ingestion pipeline
- US-008 Salesforce adapter (HubSpot complete; Salesforce stubs)

---

## Sprint 20 — Complete the Narrative Stage (Weeks 1–2)

**Objective:** The Narrative stage has a real backend agent and persists output. `NarrativeStage` reads from a real API.

**Success statement:** A VE can run the Narrative agent on a completed Integrity stage, receive an AI-generated executive summary and value story, and reload the page to find the same narrative. No hardcoded content remains in `NarrativeStage`.

**Depends on:** Sprint 19 complete. `narrative_drafts` table referenced in prior plans — verify migration exists before sprint begins; create if absent.

**Architectural rationale:** Narrative is the only missing lifecycle agent (DEBT-005). It blocks US-005 and is the last gap before the six-stage canvas is fully real. It must land before Realization (Sprint 21) because the narrative output is an input to the realization plan in the domain model. This sprint also fixes DEBT-006 (canvas title) as a low-effort co-located change.

**Competitor context:** Mediafly's content generation is presentation-layer only. A persistent, agent-generated executive narrative tied to a validated financial model is a differentiated capability — but only once it is real and not demo data.

### KR 20-1 — `NarrativeAgent.ts` implemented and registered

**Debt ref:** DEBT-005 / issue #1346  
**Acceptance criteria:**
- `packages/backend/src/lib/agent-fabric/agents/NarrativeAgent.ts` extends `BaseAgent`
- `lifecycleStage = "composing"`, `version = "1.0.0"`, `name = "NarrativeAgent"`
- Zod response schema includes: `executive_summary: z.string()`, `value_story: z.string()`, `key_proof_points: z.array(z.string()).min(3).max(5)`, `buyer_persona: z.string()`, `confidence: z.enum(["high","medium","low"])`, `reasoning: z.string()`, `hallucination_check: z.boolean().optional()`
- All LLM calls via `this.secureInvoke()` — no direct `llmGateway.complete()` calls
- Confidence threshold: 0.6 (low) – 0.85 (high) per AGENTS.md composing-stage guidance
- Handlebars prompt template (no string concatenation)
- Memory stored with `this.organizationId` (tenant isolation)
- Registered in `AgentFactory.ts`
- Unit test: mock `LLMGateway` + `MemorySystem`; assert output shape and memory write
- `pnpm test` green

### KR 20-2 — `narrative_drafts` migration and `NarrativeDraftRepository`

**Debt ref:** Stage 4 Narrative — DB table ❌, repository ❌  
**Acceptance criteria:**
- Migration `20260620000000_narrative_drafts.sql`: `id`, `organization_id`, `case_id`, `session_id`, `executive_summary text`, `value_story text`, `key_proof_points jsonb`, `buyer_persona text`, `confidence text`, `reasoning text`, `source_agent text`, `created_at`, `updated_at`; RLS via `security.user_has_tenant_access()`
- Paired rollback file
- `NarrativeDraftRepository.ts`: `createDraft(caseId, orgId, payload)`, `getLatestForCase(caseId, orgId)`
- `NarrativeAgent` wired to persist via repository after `secureInvoke`
- `pnpm run test:rls` green for `narrative_drafts`

### KR 20-3 — API endpoints and `useNarrativeOutput` hook

**Debt ref:** Stage 4 Narrative — API endpoints ❌, frontend hook ❌  
**Acceptance criteria:**
- `GET /api/v1/value-cases/:caseId/narrative` — returns latest `narrative_drafts` row or `{ data: null }`; tenant-scoped
- `POST /api/v1/value-cases/:caseId/narrative/run` — invokes `NarrativeAgent` directly (no Kafka dependency); returns `{ status: "completed", data: NarrativeDraft }`
- Both endpoints behind `requireAuth` + `tenantContextMiddleware()`
- `apps/ValyntApp/src/hooks/useNarrativeOutput.ts` — `useNarrativeOutput(caseId)` fetches GET; exposes `runAgent()` that POSTs to `/run`
- On `runAgent()` completion, invalidates the GET query

### KR 20-4 — `NarrativeStage` wired to real data; `ValueCaseCanvas` title fixed

**Debt refs:** Stage 4 Narrative — UI ⚠️; DEBT-006 / issue #1347  
**Acceptance criteria:**
- `NarrativeStage.tsx` replaces all hardcoded content with `useNarrativeOutput(caseId)` data
- Empty state: "Run the Narrative agent to generate an executive summary" when `data` is null
- `ValueCaseCanvas.tsx` header replaced with `useCase(caseId)` hook rendering `case.title` and `case.organization_name`
- No "Acme Corp" or "Enterprise Platform Migration" literal anywhere in canvas components
- `pnpm test` green

### KR 20-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green for `narrative_drafts`
- `pnpm run typecheck` passes

**Risk flags:**
- `narrative_drafts` table may already exist from a prior migration. Contingency: check `infra/supabase/supabase/migrations/` before creating; if it exists, skip the migration KR and wire the repository to the existing schema.
- Together.ai token limits may truncate long narrative outputs. Contingency: split executive summary and value story into two `secureInvoke` calls if combined prompt exceeds context window; log token usage at INFO level.

---

## Sprint 21 — Realization Stage: Persistence and Real Data (Weeks 3–4)

**Objective:** `RealizationStage` reads from a real API. `ValueCommitmentTrackingService` stubs are replaced with real DB operations.

**Success statement:** A VE can view a realization plan generated by `RealizationAgent`, create milestones, record actual metric values, and see realization % calculated against committed targets. No hardcoded Acme Corp data remains in `RealizationStage`.

**Depends on:** Sprint 20 complete. `realization_outputs` table may have been created in Sprint 17 (data observability plan) — verify before sprint begins.

**Architectural rationale:** Realization persistence (DEBT-004, DEBT-007) is the largest remaining product gap. `RealizationAgent` exists and is invocable but its output is never persisted. `ValueCommitmentTrackingService` is entirely inert. These two items share the same DB table (`realization_outputs`) and must land together. Realization must precede Expansion (Sprint 22) because expansion signals are derived from realization milestone data.

**Competitor context:** Gainsight tracks health scores and CS workflows post-deal. ValueOS's realization tracking — tied to the original value hypothesis and financial model — is a differentiated post-sale capability. It is only differentiated once it is real.

### KR 21-1 — `realization_outputs` migration and `RealizationOutputRepository`

**Debt refs:** DEBT-004 / issue #1345; Stage 5 Realization — DB table ❌, repository ❌  
**Acceptance criteria:**
- Migration `20260704000000_realization_outputs.sql`: `id`, `organization_id`, `case_id`, `session_id`, `milestones jsonb`, `metrics jsonb`, `risks jsonb`, `stakeholders jsonb`, `realization_pct numeric`, `source_agent text`, `created_at`, `updated_at`; RLS via `security.user_has_tenant_access()`
- Scalar count columns: `milestone_count int`, `risk_count int` (for aggregation without jsonb parsing)
- Paired rollback file
- `RealizationOutputRepository.ts`: `createOutput(caseId, orgId, payload)`, `getLatestForCase(caseId, orgId)`, `updateRealizationPct(id, orgId, pct)`
- `RealizationAgent` wired to persist via repository after `secureInvoke`
- `pnpm run test:rls` green

### KR 21-2 — `ValueCommitmentTrackingService` stubs resolved

**Debt ref:** DEBT-007 / issue #1348  
**Acceptance criteria:**
- All 12+ TODO stubs in `apps/ValyntApp/src/services/ValueCommitmentTrackingService.ts` replaced with real Supabase queries scoped to `organization_id`
- Milestones, metrics, risks, stakeholders write to and read from `realization_outputs`
- Audit entries include real `actor_id` from request context — no hardcoded `"Unknown"`
- Unit test: each method writes and reads back correctly; cross-tenant read returns empty

### KR 21-3 — API endpoints and `useRealizationOutput` hook

**Debt ref:** Stage 5 Realization — API endpoint ❌, frontend hook ❌  
**Acceptance criteria:**
- `GET /api/v1/value-cases/:caseId/realization` — returns latest `realization_outputs` row or `{ data: null }`; tenant-scoped
- `POST /api/agents/realization/invoke` already exists — verify it persists via `RealizationOutputRepository` (KR 21-1)
- `apps/ValyntApp/src/hooks/useRealizationOutput.ts` — fetches GET; exposes `runAgent()` that POSTs to invoke endpoint
- On `runAgent()` completion, invalidates the GET query

### KR 21-4 — `RealizationStage` wired to real data

**Debt ref:** DEBT-004 / issue #1345; Stage 5 Realization — UI ⚠️  
**Acceptance criteria:**
- `RealizationStage.tsx` replaces all hardcoded Acme Corp demo data with `useRealizationOutput(caseId)` data
- Milestones, metrics, risks, and stakeholders rendered from real API response
- Realization % displayed from `realization_pct` field
- Empty state: "Run the Realization agent to generate an implementation plan" when `data` is null
- No hardcoded arrays or demo constants remain in the component
- `pnpm test` green

### KR 21-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green for `realization_outputs`
- `pnpm run typecheck` passes
- US-006 acceptance criteria met: milestones creatable, actual values recordable, realization % calculated

**Risk flags:**
- `realization_outputs` may already exist from Sprint 17 (data observability plan KR 17-4). Contingency: check migrations directory; if table exists, skip migration and wire repository to existing schema.
- `ValueCommitmentTrackingService` stub resolution may surface unexpected data shape mismatches with `realization_outputs` schema. Contingency: add a Zod transform layer in the service to map between the service's internal types and the DB schema; do not change the service's public interface.

---

## Sprint 22 — Expansion Stage: Persistence and UI (Weeks 5–6)

**Objective:** `ExpansionAgent` output is persisted. The Expansion stage has a real frontend surface.

**Success statement:** After a value case reaches the Realization stage, the Expansion agent can be run to identify growth opportunities. Output is persisted, loadable on refresh, and visible in a dedicated `ExpansionStage` component.

**Depends on:** Sprint 21 complete (`realization_outputs` live; realization milestone data available as expansion signal input).

**Architectural rationale:** Expansion is the final lifecycle stage. It depends on realization data as input signal (expansion opportunities are derived from realized value patterns). The agent exists and is invocable but has no persistence layer (DEBT-009). This sprint completes the six-stage canvas end-to-end. After this sprint, all six stages are real.

**Competitor context:** Vivun's pipeline influence and deal room features operate pre-sale. ValueOS's expansion signal detection — grounded in post-sale realization data — is a post-sale growth capability with no direct Vivun equivalent.

### KR 22-1 — `expansion_outputs` migration and `ExpansionOutputRepository`

**Debt ref:** DEBT-009; Stage 6 Expansion — DB table ❌, repository ❌  
**Acceptance criteria:**
- Migration `20260718000000_expansion_outputs.sql`: `id`, `organization_id`, `case_id`, `session_id`, `opportunities jsonb`, `gap_analysis jsonb`, `expansion_seeds jsonb`, `source_agent text`, `created_at`; RLS via `security.user_has_tenant_access()`
- Paired rollback file
- `ExpansionOutputRepository.ts`: `createOutput(caseId, orgId, payload)`, `getLatestForCase(caseId, orgId)`
- `ExpansionAgent` wired to persist via repository after `secureInvoke`
- `pnpm run test:rls` green

### KR 22-2 — API endpoints and `useExpansionOutput` hook

**Debt ref:** Stage 6 Expansion — API endpoint ❌, frontend hook ❌  
**Acceptance criteria:**
- `GET /api/v1/value-cases/:caseId/expansion` — returns latest `expansion_outputs` row or `{ data: null }`; tenant-scoped
- `POST /api/agents/expansion/invoke` already exists — verify it persists via `ExpansionOutputRepository` (KR 22-1)
- `apps/ValyntApp/src/hooks/useExpansionOutput.ts` — fetches GET; exposes `runAgent()`
- On `runAgent()` completion, invalidates the GET query

### KR 22-3 — `ExpansionStage` component

**Debt ref:** Stage 6 Expansion — UI component ❌  
**Acceptance criteria:**
- `apps/ValyntApp/src/views/canvas/ExpansionStage.tsx` — named export, functional component
- Renders: expansion opportunities list, gap analysis summary, expansion seeds
- Empty state: "Run the Expansion agent to identify growth opportunities" when `data` is null
- "Run Expansion" button calls `runAgent()` from `useExpansionOutput`
- Registered in `LifecycleStageNav` and `ValueCaseCanvas` stage switcher
- No hardcoded data

### KR 22-4 — RecommendationEngine wired to Expansion events

**Acceptance criteria:**
- `RecommendationEngine` subscribes to `expansion.opportunities_identified` CloudEvent (emitted by `ExpansionAgent` after persist)
- Pushes a next-best-action recommendation to the UI: "Review expansion opportunities for [case name]"
- Recommendation includes `caseId`, `opportunityCount`, and a deep link to `ExpansionStage`
- Unit test: mock `MessageBus`; assert recommendation emitted on event receipt

### KR 22-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green for `expansion_outputs`
- All six lifecycle stages render real data (no hardcoded arrays in any stage component)
- `pnpm run typecheck` passes

**Risk flags:**
- `LifecycleStageNav` may not have a slot for a sixth stage. Contingency: check the nav component's stage array; add `expansion` entry following the same pattern as existing stages.
- `ExpansionAgent` may not emit a CloudEvent after persist. Contingency: add `MessageBus.publish()` call in the agent's `execute()` method after the repository write; follow the pattern in `RealizationAgent`.

---

## Sprint 23 — TypeScript `any` Reduction and Platform Hardening (Weeks 7–8)

**Objective:** The `any` debt baseline is cut by 30% across the highest-density files. The cron job for monthly partition creation is wired. The RBAC degraded-security mode is documented and tested.

**Success statement:** `pnpm run lint` reports fewer than 1,400 `any` usages (down from ~1,977 baseline). The `create_next_monthly_partitions()` scheduler is wired and tested. No new `any` is introduced in any PR touching the codebase.

**Depends on:** Sprint 22 complete (all six stages real; no new stage work to introduce `any` debt).

**Architectural rationale:** After Sprint 22, the six-stage canvas is complete. Sprint 23 is a hardening sprint — no new features. The `any` debt (1,977 usages at baseline, ~1,700 estimated remaining) is the largest ongoing code quality risk. The partition scheduler gap (documented in `decisions.md`) is a data integrity risk: without it, new rows fall into `_p_default` and are never pruned. These two items are the highest-value non-feature work before the product is considered production-safe.

### KR 23-1 — `any` reduction: highest-density backend files

**Debt ref:** Ongoing TypeScript `any` debt; `packages/backend` ~680 usages  
**Acceptance criteria:**
- `config/secrets/InputValidator.ts` (21 `any`) — replace all with Zod schemas; no `any` remains
- `api/referrals.ts` (20 `any`) — add request body types; no `any` remains
- `api/admin.ts` (20 `any`) — add request body types; no `any` remains
- `services/collaboration/AgentCollaborationService.ts` (17 `any`) — replace agent message payload `any` with typed union; no `any` remains
- Net reduction in `packages/backend`: ≥ 78 `any` usages removed
- `pnpm run lint` passes; `pnpm run typecheck` passes

### KR 23-2 — `any` reduction: `apps/ValyntApp` highest-density files

**Debt ref:** `apps/ValyntApp` 839 `any` usages (largest module)  
**Acceptance criteria:**
- Identify the 5 highest-density files in `apps/ValyntApp` via `grep -rn ": any" apps/ValyntApp/src --include="*.ts" --include="*.tsx" | sort | uniq -c | sort -rn | head -20`
- Replace `any` in those 5 files with `unknown` + type guards or explicit typed interfaces
- Net reduction in `apps/ValyntApp`: ≥ 100 `any` usages removed
- No new `any` introduced in any file touched during Sprints 20–23
- `pnpm run lint` passes

### KR 23-3 — Monthly partition scheduler wired

**Debt ref:** `decisions.md` — "Scheduler requirement: A cron job must call `SELECT public.create_next_monthly_partitions()` monthly"  
**Acceptance criteria:**
- `packages/backend/src/jobs/maintenance/createMonthlyPartitions.ts` — BullMQ repeatable job, cron `0 0 1 * *` (1st of each month)
- Calls `supabase.rpc('create_next_monthly_partitions')` using `service_role` client (cron job is an approved `service_role` use case per AGENTS.md)
- On success: logs `{ partitionsCreated, tables: ['usage_ledger','rated_ledger','saga_transitions','value_loop_events'] }` at INFO
- On failure: logs ERROR with full error detail; emits `partition_creation_failed_total` Prometheus counter
- Job registered in the BullMQ scheduler on server startup
- Unit test: mock Supabase RPC; assert job calls `create_next_monthly_partitions` and logs correctly

### KR 23-4 — RBAC degraded-security mode: test coverage and runbook

**Debt ref:** `decisions.md` — RBAC invalidation degraded-security mode when Redis unavailable  
**Acceptance criteria:**
- `packages/backend/src/lib/rbacInvalidation.ts` has a co-located test: simulate Redis unavailable → assert `rbac_redis_unavailable_total` counter increments; assert in-process cache invalidation still fires; assert no throw
- `docs/runbooks/rbac-redis-unavailable.md` — runbook: detection signal (`rbac_redis_unavailable_total` alert), diagnosis steps, remediation (restore Redis or reduce cache TTL to 0), escalation path
- `PermissionService` cache TTL is configurable via `RBAC_CACHE_TTL_SECONDS` env var (default 300); documented in runbook
- `pnpm test` green

### KR 23-5 — Test gate and `any` dashboard update

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run typecheck` passes with 0 errors
- `docs/debt/ts-any-dashboard.md` updated with new per-module counts and monthly targets
- Total `any` count ≤ 1,400 (verified by `grep -rn ": any" --include="*.ts" --include="*.tsx" | wc -l`)

**Risk flags:**
- Replacing `any` in `AgentCollaborationService.ts` may require defining a new union type for agent message payloads. Contingency: introduce a `AgentMessage` discriminated union in `packages/backend/src/types/`; do not inline the type in the service file.
- The partition scheduler job may conflict with an existing BullMQ job registration pattern. Contingency: follow the exact registration pattern used by `generateMonthlyInvoices.ts` (Sprint 17); do not invent a new pattern.

---

## Cross-Sprint Invariants

These rules apply to every PR across all four sprints. Source: `AGENTS.md`.

| Rule | Applies to |
|---|---|
| Every DB query includes `organization_id` or `tenant_id` | All new repositories, services, and observability queries |
| All agent LLM calls use `this.secureInvoke()` | NarrativeAgent (Sprint 20) |
| `service_role` only in AuthService, tenant provisioning, cron jobs | Partition scheduler (Sprint 23 KR 23-3) |
| TypeScript strict mode — no `any`, use `unknown` + type guards | All new files; `any` reduction work (Sprint 23) |
| Named exports only — no default exports | All new files |
| New agents: extend `BaseAgent`, Zod schema with `hallucination_check`, Handlebars prompts, confidence thresholds by risk tier | NarrativeAgent (Sprint 20 KR 20-1) |
| SDUI components registered in both `config/ui-registry.json` and `packages/sdui/src/registry.tsx` | Any new SDUI component |
| Tools implement `Tool<TInput, TOutput>` and register statically in `ToolRegistry.ts` | Any new tool |
| Workflows are DAGs — cycles forbidden; every state mutation needs a compensation function | Any new workflow node |
| `pnpm run test:rls` must pass on every PR touching a DB table | All migration PRs |

---

## Cross-Sprint Milestones

| Milestone | Reached when |
|---|---|
| Six-stage canvas fully real (no hardcoded data in any stage) | Sprint 22 KR 22-5 complete |
| All lifecycle agents implemented and registered | Sprint 20 KR 20-1 complete |
| All lifecycle stage DB tables exist with RLS | Sprint 22 KR 22-1 complete |
| `ValueCommitmentTrackingService` functional | Sprint 21 KR 21-2 complete |
| `any` debt below 1,400 | Sprint 23 KR 23-5 complete |
| Monthly partition scheduler wired | Sprint 23 KR 23-3 complete |

---

## Deferred (Post-Sprint 23)

- DEBT-008 — ServiceNow, Slack, SharePoint integrations (product decision pending)
- DEBT-011 — SandboxedExecutor E2B SDK (product decision pending)
- DEBT-012 — VOSAcademy content loader (content strategy pending)
- PPTX export
- Kafka rollout
- Grafana alerting rules wired to incident runbooks
- `DeviceFingerprintService` GeoIP / threat intelligence
- `EnhancedParallelExecutor` progress-to-UI via WebSocket
- US-007 — Tenant onboarding UI and context ingestion pipeline (`SupabaseMemoryBackend` exists; UI not built)
- US-008 — Salesforce adapter (HubSpot complete; Salesforce stubs remain)
- ADR-0005 — Theme precedence and token governance (proposed, not accepted)
- `any` debt below 100 (target from debt.md; Sprint 23 reaches ~1,400; sustained monthly reduction continues)
- Grafana alerting rules (dashboard in Sprint 13; alert rules post-beta)
- Checklist §25 maturity review — quarterly observability gap review process

---

## Sprint Dependency Chain

```
Sprint 20: NarrativeAgent + narrative_drafts + NarrativeStage wired
    ↓ (narrative output available as realization plan input)
Sprint 21: realization_outputs + ValueCommitmentTrackingService + RealizationStage wired
    ↓ (realization milestone data available as expansion signal)
Sprint 22: expansion_outputs + ExpansionStage + RecommendationEngine wired
    ↓ (all six stages real; no new stage work to introduce any debt)
Sprint 23: any reduction + partition scheduler + RBAC runbook
```
