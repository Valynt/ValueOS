# Spec: ValueOS Backend Refactor

## Problem Statement

The backend has accumulated three distinct architectural eras without retiring previous abstractions. The result:

- 58% of backend TypeScript (147k of 252k LOC) lives in a single flat `services/` directory with 193 files
- The canonical workflow execution path makes an HTTP round-trip to itself (QueryExecutor → AgentAPI → `fetch("http://localhost:3001")` → same process)
- The DI container is fully built but never populated; `hasService()` always returns false
- 7 parallel memory implementations coexist; the intended canonical package (`packages/memory`) has zero agent consumers
- 5 independent CircuitBreaker class definitions with incompatible config interfaces
- 6 local `LifecycleStage` type definitions with divergent member sets; a 7th vocabulary exists in `packages/shared/src/domain/Opportunity.ts`
- 61 POST_V1 (deferred) services live in the same flat directory as the 40 V1-required services
- 51 frontend files make raw `fetch()` calls, bypassing the existing `UnifiedApiClient`

The 8 agent classes (~3k LOC of business logic) are buried under ~50x their weight in infrastructure scaffolding.

---

## Scope

All 8 phases described below. Each phase is independently shippable and must pass the existing test suite before the next begins.

---

## Requirements

### R1 — Canonical LifecycleStage (Phase 1)

- One `LifecycleStage` type exported from `packages/shared/src/domain/`
- The canonical values are **product/domain stages**, not internal agent routing labels:
  `discovery | drafting | validating | composing | refining | realized | expansion`
  (aligning with the existing `OpportunityLifecycleStageSchema` in `Opportunity.ts`)
- Internal agent routing labels (`opportunity`, `modeling`, `target`, `integrity`, `narrative`) are mapped to canonical stages via an explicit adapter in `packages/backend/src/lib/agent-fabric/lifecycleStageAdapter.ts`
- All 6 local `LifecycleStage` definitions removed; all import from `@valueos/shared`
- One `LifecycleContext` interface, located in `packages/backend/src/types/agent.ts` (snake_case, used by BaseAgent); the `ValueLifecycleOrchestrator` variant deleted with the orchestrator
- ADR-0010 written documenting the canonical stage vocabulary and the mapping adapter

### R2 — Delete Dead Scaffolding (Phase 2)

- `DependencyInjectionContainer.ts` deleted; the `hasService` guard in `UnifiedAgentAPI` replaced with direct construction (which is what already happens at runtime)
- `packages/sdui-types/` deleted after confirming zero runtime imports in `apps/VOSAcademy` and `apps/mcp-dashboard`
- `packages/agent-fabric/` root-level stub package deleted (`runAgentWithBudget.ts` returns hardcoded simulated output; `types.ts` conflicts with `types/agent.ts`)
- `ValueLifecycleOrchestrator`, `IntelligentCoordinator`, `SelfHealingManager` moved to `services/post-v1/`
- `AgentFabricService` (hardcoded preview data) and `CostAwareRoutingService` (stub response body) moved to `services/post-v1/` or deleted after live-caller audit
- ADR-0011 written documenting the removal of the DI container and the module-level singleton pattern as the replacement

### R3 — Consolidate Circuit Breakers (Phase 3)

- `lib/resilience/CircuitBreaker.ts` is the single canonical implementation
- `CircuitBreakerConfig` extended with optional `recoveryTimeout` and `monitoringPeriod` fields to cover Redis and secrets use cases
- `config/secrets/CircuitBreaker.ts` deleted; `AWSSecretProvider` and `VaultSecretProvider` updated to use `createConfigurableCircuitBreaker` from `lib/resilience/`
- `services/RedisCircuitBreaker.ts` deleted; `RateLimitMetricsService` and `llmRateLimiter` updated to use canonical implementation
- `services/CircuitBreaker.types.ts` and `services/CircuitBreakerManager.types.ts` legacy shims deleted; types merged into canonical
- `CategorizedCircuitBreakerManager` refactored to delegate state machine to canonical `CircuitBreaker` rather than reimplementing inline
- The private `CircuitBreaker` class in `lib/resilience.ts` remains private (acceptable)
- ADR-0012 written documenting the canonical circuit breaker and config extension pattern

### R4 — Consolidate Memory (Phase 4)

- `packages/memory` is the canonical persistent memory layer
- `MemorySystem` (in `lib/agent-fabric/`) remains as the in-process L1 cache; its `SupabaseMemoryBackend` is updated to delegate to `packages/memory` adapters (`lib/memory/SupabaseVectorStore`, `lib/memory/SupabaseSemanticStore`) instead of calling `SemanticMemoryService` directly
- `AgentMemoryService` deleted; its single caller (`IntegrityValidationService`) updated to use `MemorySystem`
- `services/memory/MemoryService.ts` consolidated into `packages/memory/semantic`; its callers (`NarrativeEngine`, `KnowledgeFabricValidator`) updated
- DB schema migration written to align `semantic_memory` table with `packages/memory` type vocabulary where divergent
- `packages/memory` gains at least one agent consumer (via the updated `SupabaseMemoryBackend`)
- ADR-0013 written documenting the two-layer memory architecture: `packages/memory` (persistent) + `MemorySystem` (in-process L1)

### R5 — Fix the Self-HTTP-Loop (Phase 5)

- `QueryExecutor` calls `AgentFactory.create(agentType, orgId).execute(context)` directly, the same path used by `api/agents.ts`
- `AgentAPI` (the HTTP client) is used only by the frontend or external callers; no server-side code calls it for intra-process agent invocation
- `getAgentAPI()` import removed from `QueryExecutor` and any other server-side runtime callers
- An integration test added that exercises the full workflow path (`api/workflow.ts` → `ExecutionRuntime` → `QueryExecutor` → `AgentFactory` → `BaseAgent.execute()`) without a network hop
- ADR-0014 written documenting the direct-invocation rule: server-side orchestration calls `AgentFactory` directly; `AgentAPI` is a frontend/external client only

### R6 — Consolidate Cache Layer (Phase 6)

- `ReadThroughCacheService` is the canonical server-side cache utility
- `CacheService` (1,327 LOC, browser/server chimera) deleted; its callers (`UnifiedAgentAPI`, `CanvasSchemaService`) migrated to `ReadThroughCacheService`
- Cache invalidation by pattern and dependency tracking features of `CacheService` either ported to `ReadThroughCacheService` or the callers simplified; decision documented in the PR
- Service-local `Map<string, CacheEntry>` caches in `ValueFabricService`, `ContextOptimizer` left in place (non-tenant routing state, acceptable)

### R7 — Reorganize services/ Directory (Phase 7)

- `services/post-v1/` subdirectory created; all 61 POST_V1 services (as listed in `v1-service-scope.ts`) moved there
- Remaining V1 services grouped into domain subdirectories: `services/agents/`, `services/billing/`, `services/tenant/`, `services/memory/`, `services/security/`, `services/workflow/`
- Each domain subdirectory has a barrel `index.ts` that re-exports everything, preserving existing import paths during migration
- `services/` flat root contains only barrel files and any services that don't fit a domain
- A new engineer can identify the active V1 execution path without scrolling 193 files

### R8 — Unify Frontend API Layer (Phase 8)

- `UnifiedApiClient` is the mandatory client for all REST calls to the backend from `apps/ValyntApp`
- Supabase direct access permitted only for realtime subscriptions and auth
- All 51 raw `fetch()` call sites migrated to `UnifiedApiClient` or React Query hooks backed by it
- Migration priority: agent hooks first (`useAgent.ts`, `useHypothesis.ts`, `useIntegrityOutput.ts`), then value-case hooks, then remaining files
- An ESLint rule added to `apps/ValyntApp` that flags new raw `fetch()` calls to backend API routes

---

## Acceptance Criteria

1. `pnpm test` passes after each phase before the next phase begins
2. `pnpm run lint` passes after each phase
3. `pnpm run test:rls` passes after Phase 4 (schema migration)
4. After Phase 1: `grep -rn "export type LifecycleStage" packages/backend/src` returns zero results; all imports resolve to `@valueos/shared`
5. After Phase 2: `grep -rn "createServiceCollection\|addSingleton\|hasService" packages/backend/src` returns zero results outside deleted files
6. After Phase 3: `grep -rn "^export class CircuitBreaker\|^class CircuitBreaker" packages/backend/src` returns exactly 2 results (canonical + private in `lib/resilience.ts`)
7. After Phase 4: `grep -r "@valueos/memory" packages/backend/src` returns results outside `lib/memory/` adapter files (i.e., `packages/memory` has real consumers)
8. After Phase 5: `grep -rn "getAgentAPI\|AgentAPI" packages/backend/src/runtime` returns zero results
9. After Phase 6: `packages/backend/src/services/CacheService.ts` does not exist
10. After Phase 7: `find packages/backend/src/services -maxdepth 1 -name "*.ts" | wc -l` is ≤ 50 (down from 193)
11. After Phase 8: `grep -rl "fetch(" apps/ValyntApp/src` returns ≤ 5 results (legitimate non-API uses only)
12. Each phase that introduces an architectural decision produces one ADR in `docs/engineering/adr/` and one entry in `.ona/context/decisions.md`

---

## ADRs to Create

| ADR | Decision |
|---|---|
| ADR-0010 | Canonical `LifecycleStage` vocabulary and agent-routing mapping adapter |
| ADR-0011 | DI container removal; module-level singletons as the replacement pattern |
| ADR-0012 | Canonical circuit breaker; config extension pattern for domain-specific fields |
| ADR-0013 | Two-layer memory architecture: `packages/memory` (persistent) + `MemorySystem` (L1 cache) |
| ADR-0014 | Direct agent invocation rule: `AgentFactory` for server-side; `AgentAPI` for external callers only |

---

## Implementation Sequence

### Phase 1 — Type unification (1–2 days, zero runtime risk)

1. Confirm `OpportunityLifecycleStageSchema` in `packages/shared/src/domain/Opportunity.ts` as canonical: `discovery | drafting | validating | composing | refining | realized | expansion`
2. Re-export `OpportunityLifecycleStage` as `LifecycleStage` from `packages/shared/src/domain/index.ts`
3. Create `packages/backend/src/lib/agent-fabric/lifecycleStageAdapter.ts` — maps internal agent routing labels to canonical stages:
   - `opportunity → discovery`
   - `modeling → drafting`
   - `target → drafting`
   - `integrity → validating`
   - `narrative → composing`
4. Replace all 6 local `LifecycleStage` definitions with imports from `@valueos/shared`; update `AgentFactory` to use the adapter where it bridges labels
5. Delete the `LifecycleContext` variant in `ValueLifecycleOrchestrator`; confirm `types/agent.ts` version is used everywhere
6. Write ADR-0010
7. `pnpm run lint && pnpm test`

### Phase 2 — Delete dead scaffolding (1 day)

1. Audit `apps/VOSAcademy` and `apps/mcp-dashboard` for `@valueos/sdui-types` runtime imports (not just tsconfig references); delete `packages/sdui-types/` if zero confirmed
2. Delete `packages/agent-fabric/` root-level stub package
3. Replace `hasService` guard in `UnifiedAgentAPI` with direct construction; delete `DependencyInjectionContainer.ts`
4. Audit `AgentFabricService` and `CostAwareRoutingService` for live callers; move to `services/post-v1/` or delete
5. Move `ValueLifecycleOrchestrator`, `IntelligentCoordinator`, `SelfHealingManager` to `services/post-v1/`
6. Write ADR-0011
7. `pnpm run lint && pnpm test`

### Phase 3 — Consolidate circuit breakers (2 days)

1. Extend `lib/resilience/CircuitBreaker.ts` `CircuitBreakerConfig` with optional `recoveryTimeout?: number` and `monitoringPeriod?: number`
2. Update `AWSSecretProvider` and `VaultSecretProvider` to import from `lib/resilience/CircuitBreaker`; delete `config/secrets/CircuitBreaker.ts`
3. Update `RateLimitMetricsService` and `llmRateLimiter` to use canonical implementation; delete `services/RedisCircuitBreaker.ts`
4. Merge types from `services/CircuitBreaker.types.ts` and `services/CircuitBreakerManager.types.ts` into canonical; delete shim files
5. Refactor `CategorizedCircuitBreakerManager` to delegate to canonical `CircuitBreaker` instances
6. Write ADR-0012
7. `pnpm run lint && pnpm test`

### Phase 4 — Consolidate memory (3–5 days)

1. Audit type vocabulary differences between `packages/memory` and `semantic_memory` DB table
2. Write DB migration to align schema where needed (columns, CHECK constraints)
3. Update `SupabaseMemoryBackend` to delegate to `lib/memory/SupabaseSemanticStore` and `lib/memory/SupabaseVectorStore` instead of calling `SemanticMemoryService` directly
4. Update `IntegrityValidationService` to use `MemorySystem` instead of `AgentMemoryService`; delete `AgentMemoryService`
5. Consolidate `services/memory/MemoryService.ts` into `packages/memory/semantic`; update callers (`NarrativeEngine`, `KnowledgeFabricValidator`)
6. Write ADR-0013
7. `pnpm run lint && pnpm test && pnpm run test:rls`

### Phase 5 — Fix the self-HTTP-loop (2–3 days)

1. Add `AgentFactory` import to `QueryExecutor`; replace `this.agentAPI.invokeAgent(...)` call (line 321) with `AgentFactory.create(agentType, orgId).execute(context)`
2. Remove `getAgentAPI()` import from `QueryExecutor`
3. Audit `ArtifactComposer` for `getAgentAPI()` usage; replace with direct factory call if used for intra-process invocation
4. Add integration test: workflow path from `api/workflow.ts` through `ExecutionRuntime` → `QueryExecutor` → `AgentFactory` → `BaseAgent.execute()` with no network mock required
5. Write ADR-0014
6. `pnpm run lint && pnpm test`

### Phase 6 — Consolidate cache layer (2 days)

1. Audit `CacheService` usage in `UnifiedAgentAPI` and `CanvasSchemaService` — list which features are used (pattern invalidation, dependency tracking, TTL)
2. Port required features to `ReadThroughCacheService` or simplify callers
3. Migrate `UnifiedAgentAPI` and `CanvasSchemaService` to `ReadThroughCacheService`
4. Delete `CacheService.ts`
5. `pnpm run lint && pnpm test`

### Phase 7 — Reorganize services/ directory (3–4 days)

1. Create `services/post-v1/` with a `README.md` explaining deferred status
2. Move all 61 POST_V1 services (from `v1-service-scope.ts`) to `services/post-v1/`; add barrel `index.ts`
3. Create domain subdirectories: `services/agents/`, `services/billing/`, `services/tenant/`, `services/memory/`, `services/security/`, `services/workflow/`
4. Move V1 services into domain subdirectories; add barrel `index.ts` per domain
5. Fix any broken imports (barrel re-exports should prevent most breakage)
6. `pnpm run lint && pnpm test`

### Phase 8 — Unify frontend API layer (5–8 days)

1. Add ESLint rule to `apps/ValyntApp` flagging raw `fetch()` calls to `/api/` routes
2. Migrate agent hooks: `useAgent.ts`, `useHypothesis.ts`, `useIntegrityOutput.ts`
3. Migrate value-case hooks and remaining hooks in `apps/ValyntApp/src/hooks/`
4. Migrate remaining raw `fetch()` call sites in priority order
5. Verify Supabase direct access is limited to realtime subscriptions and auth
6. `pnpm run lint && pnpm test`

---

## Files to Delete

| File | Reason |
|---|---|
| `packages/backend/src/services/DependencyInjectionContainer.ts` | Never populated, never used |
| `packages/sdui-types/` (entire package) | Verbatim duplicate of `packages/sdui/src/schema.ts`; zero runtime consumers |
| `packages/agent-fabric/` (root-level stub) | Hardcoded simulated output; conflicts with `types/agent.ts` |
| `packages/backend/src/config/secrets/CircuitBreaker.ts` | Independent reimplementation; callers migrated to canonical |
| `packages/backend/src/services/RedisCircuitBreaker.ts` | Independent reimplementation; callers migrated to canonical |
| `packages/backend/src/services/CircuitBreaker.types.ts` | Legacy shim; types merged into canonical |
| `packages/backend/src/services/CircuitBreakerManager.types.ts` | Legacy shim; types merged into canonical |
| `packages/backend/src/services/AgentMemoryService.ts` | Single caller migrated to `MemorySystem` |
| `packages/backend/src/services/CacheService.ts` | Browser/server chimera; callers migrated to `ReadThroughCacheService` |

## Files to Move to services/post-v1/

`ValueLifecycleOrchestrator.ts`, `IntelligentCoordinator.ts`, `SelfHealingManager.ts`, plus all 61 services listed in `POST_V1_SERVICES` in `v1-service-scope.ts`. `AgentFabricService.ts` and `CostAwareRoutingService.ts` pending live-caller audit.

---

## Expected Outcome

- Backend LOC reduction: 30,000–50,000 lines
- `services/` drops from 193 flat files to ≤ 50, with clear domain grouping
- Both execution paths (direct and workflow) converge at `AgentFactory → BaseAgent` with no network hop
- The compiler catches `LifecycleStage` mismatches that currently pass silently
- `packages/memory` becomes the canonical persistent layer with real consumers
- 5 ADRs establish permanent standards for the patterns introduced

---

## Out of Scope

- Implementing deferred POST_V1 services (moving them is in scope; building them is not)
- Replacing `MemorySystem`'s in-process Map with a distributed cache
- Adding new agents or lifecycle stages
- Changes to the Supabase schema beyond what Phase 4 requires for memory alignment
