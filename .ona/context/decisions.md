# Architectural Decisions — Context Digest

Digest of accepted decisions for fast agent orientation.
Full records: `docs/engineering/adr/`. Update this file when a new ADR is accepted.

---

## ADR-0001 — Architecture Decision Governance (Accepted, 2025-02-06)

**Decision:** `/docs/engineering/adr/` is the canonical home for ADRs. Diagrams-as-code live in `/docs/diagrams` (Mermaid). Runbooks in `/docs/runbooks` must be updated in the same changeset as the behavior they describe.

**Consequence for agents:** Any change that affects system boundaries, data flows, or external contracts requires a new or amended ADR. Reference the ADR ID in the PR description.

---

## ADR-0017 — Service De-duplication Strategy (Accepted, 2026-07-15)

**Decision:** Verify before consolidating — two files with the same name may be intentionally distinct. Canonical locations: domain types in `packages/shared/src/domain/`, tenant limits in `services/tenant/TenantLimits.ts`, pure transformation logic in extracted `*Applier.ts` / `*Types.ts` modules. Files >1000 lines are split by cohesion, not size. Legacy root directories (`client/`, `server/`, `shared/`) are removed and banned by ESLint. Resolved debt is recorded in `debt.md`.

**Consequence for agents:** Before treating two same-named files as duplicates, read both. If distinct, document the distinction in each file's header. Do not consolidate. When extracting, re-export from the original file for backward compatibility.

---

## ADR-0016 — CI Security Gate Model (Accepted, 2026-07-15)

**Decision:** CI has a dedicated security gate after unit tests: (1) RLS policy tests (`pnpm run test:rls`), (2) agent security suite (`scripts/test-agent-security.sh`), (3) TypeScript `any` threshold enforced via coverage thresholds (lines=75%, functions=70%, branches=70%), (4) Playwright E2E critical paths with waiver tracking in `config/release-risk/release-1.0-skip-waivers.json`. ESLint enforces structural rules at PR time.

**Consequence for agents:** New tenant-scoped tables require an RLS test before merging. New agents must pass the agent security suite. Skip waivers require an owner and expiry date or they fail CI.

---

## ADR-0015 — Agent Fabric Design (Accepted, 2026-07-15)

**Decision:** Eight domain agents extend `BaseAgent` in `packages/backend/src/lib/agent-fabric/agents/`. All LLM calls go through `BaseAgent.secureInvoke()` (circuit breaker + hallucination detection + Zod validation). Six runtime services replace `UnifiedAgentOrchestrator`. Inter-agent messaging via `MessageBus` (CloudEvents) with `trace_id` propagation. Memory is tenant-scoped; all queries include `tenant_id`. Confidence thresholds are risk-tiered.

**Consequence for agents:** Never call `llmGateway.complete()` directly. Use `secureInvoke`. Every memory store/query must include `this.organizationId`. New lifecycle stages require one agent class + one DAG node + `AgentFactory` registration.

---

## ADR-0014 — Direct Agent Invocation Rule (Accepted, 2026-06-10)

**Decision:** Server-side orchestration calls `AgentFactory.create(agentType, orgId).execute(context)` directly. `AgentAPI` (HTTP client) is for external/frontend callers only. `QueryExecutor` no longer makes an HTTP round-trip to itself.

**Rule for agents and services:** Never import `AgentAPI` for intra-process agent invocation. Use `createAgentFactory(deps).create(agentType, orgId).execute(context)`.

---

## ADR-0013 — Two-Layer Memory Architecture (Accepted, 2026-06-10)

**Decision:** `MemorySystem` (in-process L1 cache) → `SupabaseMemoryBackend` → `SupabaseSemanticStore` (`packages/memory` adapter) → `semantic_memory` table. `packages/memory` is now the canonical persistent layer with real agent consumers. `AgentMemoryService` deleted.

**Consequence for agents:** Store memory via `this.memorySystem.store(...)` as before. Never import `AgentMemoryService`. For explicit DB cleanup use `SupabaseSemanticStore` directly. Every memory operation must include `organization_id`.

---

## ADR-0012 — Canonical Circuit Breaker (Accepted, 2026-06-10)

**Decision:** `lib/resilience/CircuitBreaker.ts` is the single canonical implementation. `CircuitBreakerConfig` extended with optional `recoveryTimeout`/`monitoringPeriod`/`successThreshold` fields. `config/secrets/CircuitBreaker.ts` deleted; `RedisCircuitBreaker` and `CategorizedCircuitBreakerManager` refactored to delegate to canonical. Legacy type shims deleted.

**Consequence for agents:** Import `CircuitBreaker` from `lib/resilience/CircuitBreaker` or the `services/CircuitBreaker` re-export barrel. Never define a new `CircuitBreaker` class. Use optional config fields for domain-specific needs.

---

## ADR-0011 — DI Container Removal (Accepted, 2026-06-10)

**Decision:** `DependencyInjectionContainer.ts` deleted. Module-level singletons (`getMyService()` lazy-init pattern) are the standard for shared service instances. The container was fully built but never populated — `hasService()` always returned false.

**Consequence for agents:** Never import from `DependencyInjectionContainer`. Use module-level singletons for shared instances. Tests mock at the module boundary.

---

## ADR-0010 — Canonical LifecycleStage Vocabulary (Accepted, 2026-06-10)

**Decision:** One `LifecycleStage` type, exported from `packages/shared/src/domain/`. Canonical values: `discovery | drafting | validating | composing | refining | realized | expansion`. Internal agent routing labels (`opportunity`, `modeling`, `target`, `integrity`, `narrative`) are mapped to canonical stages via `packages/backend/src/lib/agent-fabric/lifecycleStageAdapter.ts`.

**Consequence for agents:** Import `LifecycleStage` from `@valueos/shared` only. Never define it locally. When constructing `AgentConfig.lifecycle_stage`, use `agentLabelToLifecycleStage(agentType)` from the adapter. Agent class `lifecycleStage` properties remain as routing labels — the adapter translates at the factory boundary.

---

## ADR-0005 — Theme Precedence and Token Governance ⚠️ [PROPOSED — not yet accepted]

**Decision:** Design token precedence order: global base → brand theme → tenant override → component local. Tokens defined at a lower layer cannot be overridden by a higher layer without explicit `!important` annotation in the token definition.

**Consequence for agents:** Do not enforce this as settled policy. The decision is still open. Avoid hardcoding color or spacing values as a general practice, but do not block work on the basis of this ADR until it is accepted.

---

## ADR-0006 — Multi-Tenant Data Isolation and Sharding (Accepted, 2026-03-06)

**Decision:** Shared-schema, shared-database multi-tenancy. Every tenant-scoped table has `organization_id` as a required partitioning key. RLS enforces isolation at the DB layer; application queries add `organization_id` filters as defense-in-depth.

**Sharding triggers** (when to revisit): any single tenant exceeds 50M rows in a core table, p99 query latency exceeds 500ms for 3+ consecutive days, or storage per tenant exceeds 100GB.

**Consequence for agents:**
- Every `supabase.from(...)` call on a tenant table MUST include `.eq("organization_id", orgId)`.
- Every vector/memory query MUST include `{ metadata: { tenant_id: orgId } }`.
- `service_role` bypasses RLS — restrict to AuthService, tenant provisioning, cron jobs only.
- Cross-tenant data transfer is forbidden in application logic, no exceptions.

---

## Undocumented decisions (not yet in ADR format)

These are established patterns without a formal ADR. They should be promoted to ADRs.

### LLM Provider: Together.ai only (current)

`LLMGateway` implements only the `together` provider. The `openai`, `anthropic`, `gemini`, and `custom` branches throw `'Provider not implemented'`. All agent code and factory configuration must use `provider: "together"` until additional providers are implemented.

**Note:** `getDirectFactory()` previously hardcoded `provider: "openai"` — resolved in Sprint 11 (DEBT-001). `UnifiedAgentOrchestrator` was deleted in the Sprint 10 architectural refactor.

### Agent LLM calls: secureInvoke only

All production LLM calls go through `this.secureInvoke()` on `BaseAgent`. Direct calls to `llmGateway.complete()` from agent code are forbidden. `secureInvoke` wraps circuit breaker, hallucination detection, and Zod validation.

### Workflow topology: DAGs only

Agent workflows are directed acyclic graphs. Cycles are forbidden. Every state mutation requires a compensation function (saga pattern). `WorkflowState` is persisted to Supabase after every node transition.

### Standalone agents in `packages/agents/` are deprecated

The Express microservices in `packages/agents/` use mock data and are superseded by the agent-fabric implementations in `packages/backend/src/lib/agent-fabric/agents/`. Do not extend them.

### Frontend: named exports, functional components, no default exports

All React components use named exports. No default exports anywhere in the codebase. Functional components with hooks only.

### SDUI component registration

Every new SDUI component must be registered in both `config/ui-registry.json` and `packages/sdui/src/registry.tsx`. Registering in only one place causes runtime failures.

### Tool registration: static only

Tools implement `Tool<TInput, TOutput>` and are registered statically in `ToolRegistry.ts`. Dynamic tool creation at runtime is forbidden.

### RBAC invalidation: degraded-security mode when Redis is unavailable

**Decision:** When Redis is unavailable, `publishRbacInvalidation()` and `subscribeRbacInvalidation()` fall back gracefully rather than throwing. In-process cache invalidation still fires, so single-instance deployments are unaffected.

**Trade-off accepted:** In a multi-instance deployment without Redis, each instance holds its own `PermissionService` role cache. A role or membership change on one instance will not propagate to others until the cache TTL expires (default: 5 minutes). During that window, a user whose permissions were revoked may retain access on instances that have not yet received the invalidation event.

**Mitigations in place:**
- `rbac_redis_unavailable_total` Prometheus counter increments on every missed publish or subscribe. `RbacRedisPubSubUnavailable` alert fires after 5 minutes of sustained increments (`infra/k8s/monitoring/rbac-alerts.yaml`).
- Both paths log at `warn` (publish) / `error` (subscribe) so the condition is visible in structured logs.
- `permissionService.destroy()` is called in `registerGracefulShutdown()` to cleanly unsubscribe the Redis pub/sub connection on shutdown.

**When to revisit:** If the deployment model requires zero-tolerance for stale permissions (e.g., regulated environments), replace the TTL-based fallback with a synchronous DB check on every request, or reduce the cache TTL to 0 when Redis is unavailable.

**Files:** `packages/backend/src/lib/rbacInvalidation.ts`, `packages/backend/src/services/auth/PermissionService.ts`, `packages/backend/src/server.ts`

### High-volume table partitioning (Sprint 16)

`usage_ledger`, `rated_ledger`, `saga_transitions`, and `value_loop_events` are now `PARTITION BY RANGE (created_at / rated_at)` tables (migration `20260401000000`). Monthly partitions are created explicitly; a `_p_default` catch-all partition absorbs rows that fall outside named ranges.

**Scheduler requirement:** A cron job must call `SELECT public.create_next_monthly_partitions()` monthly (e.g. `0 0 1 * *`) to create the next two partitions before they are needed. Without this, new rows fall into `_p_default` and are never pruned. Wire via pg_cron or an external scheduler before the first month boundary after deployment.

**PK change:** Composite PKs `(id, partition_key)` replace the previous uuid-only PKs. Application queries by `id` alone still work. FK references to these tables from other tables are not supported by Postgres on partitioned tables — use application-level joins instead.

**Trade-off accepted:** The `_p_default` partition is a safety net, not a long-term home. Rows in `_p_default` cannot be moved to a named partition without a `DELETE + INSERT`. Monitor `_p_default` row count; if it grows, the scheduler is not running.

**Files:** `infra/supabase/supabase/migrations/20260401000000_partition_high_volume_tables.sql`

---

### SecurityMonitor alert channels are implemented (not stubs)

`packages/backend/src/services/security/SecurityMonitor.ts` implements key alert delivery channels via webhook URLs, including: email (`SECURITY_EMAIL_WEBHOOK_URL`), Slack (`SECURITY_SLACK_WEBHOOK_URL`), PagerDuty (`SECURITY_PAGERDUTY_ROUTING_KEY`), security-team escalation (`SECURITY_TEAM_WEBHOOK_URL`), and management escalation (`SECURITY_MANAGEMENT_WEBHOOK_URL`). Each method gracefully no-ops when the env var is absent. DEBT-010 in `debt.md` was incorrect and has been corrected (2026-07-15).

---

### RecommendationEngine is the sixth runtime service

`packages/backend/src/runtime/recommendation-engine/RecommendationEngine.ts` is a fully wired runtime service alongside the five originally documented ones (DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer). It subscribes to four domain events (`opportunity.updated`, `hypothesis.validated`, `evidence.attached`, `realization.milestone_reached`) and pushes next-best-action `Recommendation` objects to UI clients via `RealtimeBroadcastService`. It is started in `server.ts` and has its own test suite. All references to "five runtime services" in documentation were incorrect — there are six.
