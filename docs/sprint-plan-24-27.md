# Sprint Plan — Sprints 24–27: Security Hardening, Tenant Isolation, and Type Safety

**Author:** Ona (AI Engineering Agent)
**Date:** 2026-07-01
**Baseline:** Post-Sprint 23

---

## Reconciliation Note

This document merges two planning inputs. Conflicts resolved as follows:

| Conflict | Resolution |
|---|---|
| Both inputs claimed Sprint 24 | Plan B's async tenant isolation is higher-risk (one malformed event affects all consumers simultaneously) → takes Sprint 24. Plan A's skip-marked security bugs move to Sprint 25. |
| Plan B Sprint 26 targeted `InputValidator.ts` / `AgentCollaborationService.ts` — same files as Sprint 21 KRs | Sprint 21 work is **not yet done** (measured: `InputValidator.ts` 21 usages, `AgentCollaborationService.ts` 17 usages). Retained in Sprint 26. |
| Plan B stated `DomainEventBus` has no `tenant_id` enforcement | **Incorrect.** `DomainEventSchemas.ts` already enforces `tenantId: z.string().uuid()` on every domain event. `RecommendationEngine` uses `DomainEventBus`, not `realtime/MessageBus`. The real gaps are: (1) `realtime/MessageBus` (`CommunicationEvent` type has no `tenant_id`), and (2) missing consumer-side guards for empty `tenantId` in `RecommendationEngine`. |
| Plan B stated `PermissionService` cache key collision risk between tenants | `roles` table is system-global (no `organization_id` column in the active schema). Cross-tenant cache collision is not possible for role definitions. Descoped. |
| Partition scheduler + RBAC runbook appear in both Plan B Sprint 26 and prior `sprint-plan-20-23.md` Sprint 22 | Sprint 22 work is **not yet done** (no `pg_cron` migration exists, `docs/runbooks/rbac-redis-unavailable.md` does not exist). Retained in Sprint 26. |
| `TenantContextIngestionService` (Plan B Sprint 27) vs pure type cleanup (Plan A Sprint 27) | Compatible — both fit in Sprint 27. |

---

## Baseline

### Current sprint: 24

### What is complete (✅ full traceability)

- All six lifecycle stages — full stack slices live (Stages 1–6)
- `valueCasesRouter` mounted at `/api/v1/cases` and `/api/v1/value-cases` in `server.ts`
- `ValueCommitmentTrackingService` — all 15 TODO stubs replaced with real DB operations (Sprint 20)
- Six runtime services wired: DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer, RecommendationEngine
- `DomainEventBus` enforces `tenantId: z.string().uuid()` on every domain event (publish-side Zod validation)
- RLS on all tenant tables; `pnpm run test:rls` suite wired
- High-volume table partitioning live (`usage_ledger`, `rated_ledger`, `saga_transitions`, `value_loop_events`)
- Billing backend + frontend complete
- RBAC invalidation degraded-mode test exists (`rbacInvalidation.test.ts`)
- Security findings F-001–F-006 resolved (PR #1448)
- `any` reduction: Sprints 21–23 targets **not fully delivered** — measured actuals below are the authoritative baseline for this horizon

### What is open (sequenced into this horizon)

**Async isolation gaps:**
- `realtime/MessageBus` (`CommunicationEvent` type) has no `tenant_id` field — used by `BillingSpendEvaluationService` and the broadcast path
- `CommunicationEvent.ts` is missing `CreateCommunicationEvent`, `ChannelConfig`, `MessageHandler`, `MessageStats` type exports — `MessageBus.ts` imports them but they are not defined (pre-existing compile error)
- `RecommendationEngine` event handlers propagate `payload.tenantId` but have no explicit guard rejecting events where `tenantId` is empty or missing
- No CI test exercises mixed-tenant async payloads

**Skip-marked security bugs (tests pin current broken behaviour):**
- `useAuth` writes full user profile to `localStorage` on every render (`useAuth.localstorage.test.tsx`)
- `ReadThroughCacheService.invalidateEndpoint` uses `redis.keys()` — O(N) blocking scan (`cache.keys-scan.test.ts`)
- `RedTeamAgent` calls `llmGateway.complete()` directly — bypasses `secureInvoke` (`redteam-agent.secureinvoke.test.ts`)
- `projects` router does not call `auditLogService` on mutations (`projects.audit-log.int.test.ts`, 3 skip-marked)

**Infrastructure gaps (Sprint 22 not yet delivered):**
- Partition scheduler: `create_next_monthly_partitions()` exists in DB but no cron job calls it
- RBAC runbook: `docs/runbooks/rbac-redis-unavailable.md` does not exist

**TypeScript `any` debt (measured actuals):**
- `packages/backend`: 764 — `InputValidator.ts` (21), `AgentCollaborationService.ts` (17), `PlaygroundAutoSave.ts` (13), `OfflineEvaluation.ts` (13), `unified-api-client.ts` (11)
- `apps/ValyntApp`: 257 — `IntegratedMCPServer.ts` (19), `unified-api-client.ts` (11), `performance.ts` (10), `logger.ts` (10)
- `packages/sdui`: 146 — `WebSocketDataSource.ts` (13), `DataBindingResolver.ts` (12), `canvas/types.ts` (7), `WebSocketManager.ts` (6), `lib/logger.ts` (6)
- `packages/mcp`: 96; `apps/VOSAcademy`: 85

**Feature foundation:**
- `TenantContextIngestionService` does not exist — US-007 onboarding UI is blocked on it

### What is deferred (post-Sprint 27)

- US-007 tenant onboarding UI (Sprint 27 delivers the backend service; UI is next horizon)
- US-008 Salesforce adapter
- PPTX export
- Kafka rollout
- Grafana alerting rules wired to incident runbooks
- `DeviceFingerprintService` GeoIP / threat intelligence
- `EnhancedParallelExecutor` progress-to-UI via WebSocket
- ADR-0005 Theme Precedence (proposed, not accepted)
- `expansion.opportunities_identified` CloudEvent in RecommendationEngine (MVP trigger adequate)
- `packages/mcp` and `apps/VOSAcademy` `any` reduction (next horizon)

---

## Sprint 24 — Async Tenant Isolation (Weeks 1–2)

**Objective:** Every message on `realtime/MessageBus` carries a `tenant_id`. `RecommendationEngine` handlers explicitly guard against missing `tenantId`. A mixed-tenant async integration test runs in CI.

**Success statement:** Publishing a `CommunicationEvent` without `tenant_id` throws at the call site. `RecommendationEngine` handlers log and return without processing when `tenantId` is absent. `pnpm test` includes a `MessageBus.tenant-isolation` suite that passes.

**Depends on:** Sprint 23 complete.

**Architectural rationale:** `DomainEventBus` (domain events) already enforces `tenantId` via Zod. The gap is `realtime/MessageBus` (`CommunicationEvent`), used for billing alerts and the broadcast path — neither carries `tenant_id` today. This is ordered first because async paths are higher-risk than synchronous ones: a single malformed event can affect all subscribers simultaneously. The pre-existing compile error in `CommunicationEvent.ts` (missing type exports) must be resolved as the first commit of this sprint before any other change.

**Competitor context:** Gainsight and Vivun operate multi-tenant event pipelines. Tenant context in event envelopes is required for SOC 2 Type II audit of async data flows.

### KR 24-1 — `CommunicationEvent.ts` complete and `tenant_id` required

**Acceptance criteria:**
- `packages/backend/src/types/CommunicationEvent.ts` defines all missing types: `CreateCommunicationEvent`, `ChannelConfig`, `MessageHandler`, `MessageStats` (currently imported by `MessageBus.ts` but absent — compile error)
- `CommunicationEvent` gains required field `tenant_id: string`
- `realtime/MessageBus.publishMessage()` validates `tenant_id` is non-empty before publishing; throws `Error('CommunicationEvent missing tenant_id')` if absent
- All existing `publishMessage()` call sites (currently: `BillingSpendEvaluationService`) updated to pass `tenant_id`
- `pnpm run lint` passes

### KR 24-2 — `RecommendationEngine` consumer-side `tenantId` guards

**Acceptance criteria:**
- Each of the four event handlers (`onOpportunityUpdated`, `onHypothesisValidated`, `onEvidenceAttached`, `onMilestoneReached`) adds an explicit guard at the top:
  ```typescript
  if (!payload.tenantId) {
    logger.error('RecommendationEngine: event missing tenantId', { sourceEvent });
    return;
  }
  ```
- Unit tests: valid payload with `tenantId` → handler processes; `tenantId: ''` → returns without processing, logs error; `tenantId: undefined` → same
- `pnpm test` green for `RecommendationEngine` suite

### KR 24-3 — `DomainEventBus` call sites pass non-empty `traceId`

**Acceptance criteria:**
- Grep `bus.publish(` across all non-test files; any call site passing `traceId: ''` or omitting it is fixed to use `crypto.randomUUID()` as fallback
- `pnpm run lint` passes

### KR 24-4 — Mixed-tenant async integration test

**Acceptance criteria:**
- `packages/backend/src/services/__tests__/MessageBus.tenant-isolation.test.ts` added:
  - Publishing `CommunicationEvent` without `tenant_id` → throws at `publishMessage()` call site
  - Publishing with `tenant_id: 'tenant-a'` → subscriber callback receives the event with `tenant_id: 'tenant-a'` intact (bus delivers faithfully; tenant enforcement is the consumer's responsibility, tested in KR 24-2)
  - Publishing with matching `tenant_id` → subscriber invoked and `event.tenant_id` equals the published value
- `packages/backend/src/runtime/recommendation-engine/__tests__/RecommendationEngine.tenant-guard.test.ts` added (or extended from KR 24-2 unit tests):
  - Handler receives event with `tenant_id: 'tenant-a'` but `payload.tenantId` is `''` → handler returns without processing, logs error
  - Handler receives event with valid `payload.tenantId` → processes normally
- `pnpm test` green including both suites

### KR 24-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run lint` passes
- No `publishMessage()` call site omits `tenant_id`

**Risk flags:**
- The missing type exports in `CommunicationEvent.ts` are a pre-existing compile error. Define all four types in the first commit of the sprint; do not proceed to other KRs until `pnpm run lint` passes.
- `BillingSpendEvaluationService` may not have `tenant_id` available at the call site. Contingency: thread `organizationId` from the billing evaluation context; if unavailable, use `'system'` as a sentinel and document in `debt.md`.

---

## Sprint 25 — Skip-Marked Security Bugs (Weeks 3–4)

**Objective:** All four skip-marked security bugs are fixed and their tests pass without `.skip`.

**Success statement:** `pnpm test` passes with no `.skip` markers on the four target suites. `useAuth` no longer writes user data to `localStorage`. `ReadThroughCacheService` uses cursor-based `SCAN`. `RedTeamAgent` uses `secureInvoke`. The `projects` router emits audit records on every mutation.

**Depends on:** Sprint 24 complete.

**Architectural rationale:** These bugs were documented with skip-marked tests in PR #1452. Each has a pinned test asserting the broken behaviour. Fixing them before adding new features prevents permanent `.skip` debt accumulation. `RedTeamAgent`'s `secureInvoke` migration is required by AGENTS.md Rule 2 and blocks any production use of the agent.

**Competitor context:** `localStorage` user profile exposure and absent audit trails fail enterprise security reviews — a blocker for deals with CFO/VP Finance buyers.

### KR 25-1 — `useAuth` localStorage write removed

**Ref:** `apps/ValyntApp/src/__tests__/useAuth.localstorage.test.tsx`

**Acceptance criteria:**
- `localStorage.setItem` no longer called from `client/src/_core/hooks/useAuth.ts` on render
- "currently writes" assertions in `useAuth.localstorage.test.tsx` replaced with "does NOT write" assertions
- No code path writes the full user profile to `localStorage` under `"manus-runtime-user-info"`
- `pnpm test` passes for the `useAuth.localstorage` suite without `.skip`

### KR 25-2 — `ReadThroughCacheService` KEYS → SCAN

**Ref:** `packages/backend/src/services/ReadThroughCacheService.ts:63`

**Acceptance criteria:**
- `invalidateEndpoint` replaces `redis.keys(pattern)` with a cursor-based `SCAN` loop (batch size 100)
- Loop bounded: exits after 10,000 keys scanned or all matching keys deleted; logs `warn` if bound is hit
- Pinned test in `cache.keys-scan.test.ts` passes without `.skip`
- `pnpm run lint` passes

### KR 25-3 — `RedTeamAgent` migrated to `secureInvoke`

**Ref:** `packages/backend/src/lib/agents/orchestration/agents/RedTeamAgent.ts`

**Acceptance criteria:**
- `RedTeamAgent` extends `BaseAgent`
- All LLM calls use `this.secureInvoke(sessionId, prompt, schema, options)` — zero direct `llmGateway.complete()` calls remain
- Zod schema includes `hallucination_check: z.boolean().optional()`
- Memory store calls include `this.organizationId`
- Skip-marked `describe.skip('RedTeamAgent — after BaseAgent migration')` block passes without `.skip`
- `pnpm test` green for the full `redteam-agent` suite

### KR 25-4 — `projects` router audit trail wired

**Ref:** `packages/backend/src/api/projects.ts`; `packages/backend/src/__tests__/projects.audit-log.int.test.ts`

**Acceptance criteria:**
- `auditLogService.createEntry()` called on project create, update, and delete with `actor_id`, `organization_id`, `action`, `resource_id`, `timestamp`
- Three skip-marked tests in `projects.audit-log.int.test.ts` pass without `.skip`
- No existing project router tests regress
- `pnpm test` green for the full `projects` suite

### KR 25-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green with zero `.skip` markers on the four target suites
- `pnpm run test:rls` green
- `pnpm run lint` passes

**Risk flags:**
- `useAuth` hook is in `client/src/_core/hooks/useAuth.ts` — outside the standard `apps/ValyntApp/src` tree. If the hook is generated, add a lint rule blocking `localStorage.setItem` in auth hooks rather than editing the generator output.
- `RedTeamAgent` has no `organizationId` today. If full `BaseAgent` extension requires a larger refactor, scope this KR to wrapping the LLM call in `secureInvoke` as a standalone method and document the remaining gap in `debt.md`.
- `projects` router requires `auditLogService` in scope. Use module-level singleton (`getAuditLogService()` per ADR-0011) rather than constructor injection.

---

## Sprint 26 — Partition Scheduler, RBAC Runbook, and Backend `any` Reduction (Weeks 5–6)

**Objective:** The monthly partition creation job is wired. The RBAC runbook exists. `packages/backend` `any` count is reduced by ≥100 from the measured baseline of 764.

**Success statement:** `create_next_monthly_partitions()` runs on a monthly schedule. `docs/runbooks/rbac-redis-unavailable.md` exists with diagnosis and remediation steps. `pnpm run lint` reports fewer than 664 `any` usages in `packages/backend`.

**Depends on:** Sprint 25 complete. No new feature work — pure platform hardening.

**Architectural rationale:** The partition scheduler gap compounds monthly: without it, `_p_default` grows unboundedly and partitioned tables lose their pruning benefit. The RBAC runbook gap means the `rbac_redis_unavailable_total` alert fires with no playbook. Both were scheduled for Sprint 22 and not delivered. The `any` reduction targets the four highest-density backend files, which are self-contained and do not ripple across the system.

### KR 26-1 — Partition scheduler wired

**Debt ref:** `decisions.md` — High-volume table partitioning; scheduler requirement

**Acceptance criteria:**
- Migration `20260801000000_pg_cron_partition_scheduler.sql`:
  ```sql
  SELECT cron.schedule('partition-monthly', '0 0 1 * *',
    $$SELECT public.create_next_monthly_partitions()$$);
  ```
- Paired rollback `20260801000000_pg_cron_partition_scheduler.rollback.sql`:
  ```sql
  SELECT cron.unschedule('partition-monthly');
  ```
- If `pg_cron` is unavailable: BullMQ repeatable job `PartitionMaintenanceJob` in `packages/backend/src/runtime/` calls `SELECT public.create_next_monthly_partitions()` via service-role client as fallback
- `docs/runbooks/partition-maintenance.md` documents: how to verify the job ran, how to manually trigger it, what to do if `_p_default` row count grows
- `decisions.md` updated: scheduler requirement marked resolved

### KR 26-2 — RBAC degraded-security runbook

**Debt ref:** `decisions.md` — RBAC invalidation degraded-security mode

**Acceptance criteria:**
- `docs/runbooks/rbac-redis-unavailable.md` created with:
  - Detection: `rbac_redis_unavailable_total` counter; alert fires after 5 minutes of sustained increments
  - Diagnosis: check Redis connectivity; check `rbacInvalidation.ts` logs for `warn`/`error` entries
  - Impact: stale permissions possible for up to `RBAC_CACHE_TTL_SECONDS` (default 300s) in multi-instance deployments
  - Remediation A: restore Redis connectivity
  - Remediation B: set `RBAC_CACHE_TTL_SECONDS=0` to force DB check on every request (performance cost documented)
  - Escalation: if neither resolves within 15 minutes, restart affected instances to flush in-process caches
- `RBAC_CACHE_TTL_SECONDS` documented in runbook and `.env.example`
- Alert annotation links to runbook (in `infra/k8s/monitoring/rbac-alerts.yaml` if it exists; otherwise as comment in `rbacInvalidation.ts`)

### KR 26-3 — `packages/backend` `any` reduction: four highest-density files

**Debt ref:** Ongoing TypeScript `any` debt; measured baseline 764

**Acceptance criteria:**
- `config/secrets/InputValidator.ts` (21): all replaced with Zod schemas
- `services/collaboration/AgentCollaborationService.ts` (17): agent message payload `any` replaced with typed union from `packages/shared/src/domain/`
- `services/post-v1/PlaygroundAutoSave.ts` (13): `any` replaced with typed alternatives
- `services/post-v1/OfflineEvaluation.ts` (13): `any` replaced with typed alternatives
- Net reduction: ≥64 from these four files; combined with incidental reductions across other touched files, target ≥100 total
- `pnpm run lint` passes

### KR 26-4 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run lint` passes
- `packages/backend` `any` count confirmed below 664 (≥100 removed from 764 baseline)

**Risk flags:**
- `pg_cron` may not be enabled on the Supabase project. Contingency: implement BullMQ fallback as the primary path; document `pg_cron` as the preferred alternative in the runbook.
- `AgentCollaborationService.ts` message payload types may not have a canonical definition in `packages/shared`. Contingency: define `AgentMessage` union in `packages/backend/src/types/` scoped to the service; do not block on a shared package change.
- `PlaygroundAutoSave.ts` and `OfflineEvaluation.ts` are in `services/post-v1/` — verify these files are not generated before editing.

---

## Sprint 27 — Frontend `any` Reduction and Tenant Onboarding Foundation (Weeks 7–8)

**Objective:** `packages/sdui` `any` count is below 50. `apps/ValyntApp` `any` count is below 207. `TenantContextIngestionService` exists with a defined interface, Zod-validated input, and tenant-scoped memory storage.

**Success statement:** `pnpm run lint` reports fewer than 50 `any` usages in `packages/sdui` and fewer than 207 in `apps/ValyntApp`. `docs/debt/ts-any-dashboard.md` is updated. `TenantContextIngestionService` has passing unit tests and is ready for a UI sprint to call.

**Depends on:** Sprint 26 complete.

**Architectural rationale:** After Sprint 26, all P1 debt and infrastructure gaps are resolved. Sprint 27 has two tracks: (1) `any` reduction in the rendering and frontend layers, and (2) the backend foundation for US-007 tenant onboarding. The ingestion service is backend-only this sprint — no UI. This follows the sequencing rule: persistence before UI. The service must exist and be tested before a UI sprint is scheduled.

**Competitor context:** Mediafly and Gainsight offer tenant-specific content libraries. ValueOS's tenant context layer — company products, ICPs, competitors, personas seeded into semantic memory — makes agent outputs firm-specific rather than generic. This sprint makes that capability buildable.

### KR 27-1 — `packages/sdui` `any` reduction: highest-density files

**Debt ref:** Ongoing TypeScript `any` debt; `packages/sdui` 146 usages

**Acceptance criteria:**
- `realtime/WebSocketDataSource.ts` (13): message payload types and event handler signatures typed; no `any` remains
- `DataBindingResolver.ts` (12): binding resolution types use `unknown` + type guards where shape is genuinely dynamic; no `any` remains
- `canvas/types.ts` (7) + `types.ts` (5): all 12 combined usages replaced
- `realtime/WebSocketManager.ts` (6) + `lib/logger.ts` (6): all 12 combined usages replaced
- If prop interfaces change, `config/ui-registry.json` and `packages/sdui/src/registry.tsx` updated in the same PR (AGENTS.md SDUI registration rule)
- `packages/sdui` `any` count below 50 (from 146)
- `pnpm run lint` passes for `packages/sdui`

### KR 27-2 — `apps/ValyntApp` `any` reduction: highest-density files

**Debt ref:** Ongoing TypeScript `any` debt; `apps/ValyntApp` 257 usages

**Acceptance criteria:**
- Replace `any` in top 4 files: `IntegratedMCPServer.ts` (19), `unified-api-client.ts` (11), `performance.ts` (10), `logger.ts` (10) — ≥50 usages removed
- `apps/ValyntApp` `any` count below 207 (≥50 removed from 257)
- `pnpm run lint` passes

### KR 27-3 — `TenantContextIngestionService` interface and stub

**Debt ref:** US-007 (⚠️ partial); ADR-0013 two-layer memory architecture

**Acceptance criteria:**
- `packages/backend/src/services/TenantContextIngestionService.ts` created:
  - `TenantContextSource` Zod schema: `{ id, orgId, label, type: "document" | "url" | "icp" | "competitor", content, ingestedAt }`
  - `ingestDocument(orgId: string, source: TenantContextSource): Promise<void>` — stores as semantic memory scoped to `orgId`
  - `ingestUrl(orgId: string, url: string, label: string): Promise<void>` — validates URL against the production network allowlist before fetching; throws `Error('URL not in allowlist')` for blocked domains without making an outbound request. If a canonical allowlist utility exists in `packages/backend/src/services/security/`, use it. If not, define a `TENANT_INGESTION_ALLOWED_HOSTS` constant in the service file with the domains from `.windsurf/rules/global.md` GR-002 (internal services, LLM providers, monitoring, CDN) and add a `// TODO: consolidate with canonical allowlist` comment
  - `listSources(orgId: string): Promise<TenantContextSource[]>` — returns all ingested sources for the tenant
  - `deleteSource(orgId: string, sourceId: string): Promise<void>` — removes source and its memory entries
  - All methods pass `orgId` to every `MemorySystem.storeSemanticMemory()` / query call with `metadata: { tenant_id: orgId, source_type: source.type }`
- Unit tests:
  - `ingestDocument` stores memory with correct `tenant_id`
  - `listSources` returns only the calling tenant's sources; cross-tenant call returns empty
  - `ingestUrl` with a blocked domain throws without fetching
- `pnpm run lint` passes

### KR 27-4 — `ts-any-dashboard.md` updated

**Debt ref:** Ongoing TypeScript `any` debt

**Acceptance criteria:**
- `docs/debt/ts-any-dashboard.md` updated with per-module counts measured at end of Sprint 27
- Monthly targets revised based on actual reduction velocity from Sprints 21–27
- `debt.md` ongoing `any` section updated with new baseline and revised targets

### KR 27-5 — Test gate

**Acceptance criteria:**
- `pnpm test` green
- `pnpm run test:rls` green
- `pnpm run lint` passes
- `packages/sdui` `any` count below 50; `apps/ValyntApp` below 207
- No new `any` introduced in any file touched across Sprints 24–27

**Risk flags:**
- `DataBindingResolver.ts` resolves bindings against dynamic runtime data. Use `unknown` + a `isBindingValue(v: unknown): v is BindingValue` type guard at the boundary; document in a code comment explaining why the boundary is dynamic.
- `IntegratedMCPServer.ts` is in `apps/ValyntApp/src/mcp-ground-truth/` — a non-standard path. If generated or auto-synced, add a lint rule blocking `any` in that path and fix the generator rather than editing the file directly.
- `TenantContextIngestionService.ingestUrl()` makes an outbound HTTP request. The allowlist fallback is specified in the acceptance criteria; no additional contingency needed here.

---

## Cross-Sprint Invariants

These rules apply to every PR across all four sprints. Sourced from `AGENTS.md`.

| Rule | Enforcement |
|---|---|
| Every DB query on a tenant table includes `organization_id` or `tenant_id` | Code review + `pnpm run test:rls` |
| Every vector/memory query filters on `tenant_id` in metadata | Code review |
| All agent LLM calls use `this.secureInvoke()` — no direct `llmGateway.complete()` | Code review |
| `service_role` used only in AuthService, tenant provisioning, cron jobs | Code review |
| No cross-tenant data transfer | Code review + RLS |
| No new `any` introduced | `pnpm run lint` |
| Named exports only — no default exports | `pnpm run lint` |
| Zod schemas for all LLM responses; include `hallucination_check: boolean` | Code review |
| Saga pattern: every state mutation has a compensation function | Code review |
| `WorkflowState` persisted to Supabase after every node transition | Code review |
| SDUI component registration requires both `config/ui-registry.json` and `packages/sdui/src/registry.tsx` | Code review |
| CloudEvent envelopes include `tenant_id` (Sprint 24+) | Code review + `MessageBus.tenant-isolation.test.ts` |

---

## Sprint Dependency Chain

```
Sprint 24: realtime/MessageBus tenant_id + RecommendationEngine consumer guards
    ↓ (async paths hardened; CommunicationEvent compile error resolved)
Sprint 25: skip-marked security bugs fixed (useAuth, SCAN, RedTeamAgent, projects audit)
    ↓ (no skip debt; Rule 2 compliant; audit trail complete)
Sprint 26: partition scheduler + RBAC runbook + backend any reduction
    ↓ (all P1 debt resolved; platform production-safe)
Sprint 27: sdui + ValyntApp any reduction + TenantContextIngestionService foundation
```
