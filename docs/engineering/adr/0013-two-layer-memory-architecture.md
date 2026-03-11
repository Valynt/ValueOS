# ADR-0013 — Two-Layer Memory Architecture

**Status:** Accepted  
**Date:** 2026-06-10  
**Deciders:** Engineering

---

## Context

Seven distinct memory abstractions existed:

| # | Implementation | LOC | Used by |
|---|---|---|---|
| 1 | `lib/agent-fabric/MemorySystem.ts` | 556 | All agents via BaseAgent |
| 2 | `@valueos/shared` SemanticMemoryService | — | Backend for #1 via SupabaseMemoryBackend |
| 3 | `services/AgentMemoryService.ts` | 620 | IntegrityValidationService only |
| 4 | `services/memory/MemoryService.ts` | 276 | NarrativeEngine, KnowledgeFabricValidator |
| 5 | `services/memory/MemoryPipeline.ts` | — | Standalone chunking/ingestion |
| 6 | `packages/memory/*` (@valueos/memory) | 2,250 | Only two adapter files in lib/memory/ |
| 7 | `lib/memory/SupabaseVectorStore.ts` + `SupabaseSemanticStore.ts` | — | Not wired into any agent |

`packages/memory` was the intended canonical layer but had zero agent consumers. `SupabaseMemoryBackend` called `SemanticMemoryService` from `@valueos/shared` instead of the `packages/memory` adapters.

---

## Decision

**Two-layer memory architecture:**

```
Agent code
    │
    ▼
MemorySystem (lib/agent-fabric/MemorySystem.ts)
    │  In-process Map cache (L1). Fast, request-scoped.
    │  Falls through to backend on miss.
    ▼
SupabaseMemoryBackend (lib/agent-fabric/SupabaseMemoryBackend.ts)
    │  Bridges MemorySystem to packages/memory adapters.
    ▼
SupabaseSemanticStore (lib/memory/SupabaseSemanticStore.ts)
    │  Implements SemanticStore from @valueos/memory.
    ▼
semantic_memory table (Supabase / Postgres)
```

**Changes made:**
1. `SupabaseMemoryBackend` refactored to use `SupabaseSemanticStore` (the `packages/memory` adapter) instead of `SemanticMemoryService` from `@valueos/shared`. `packages/memory` now has a real agent consumer.
2. `AgentMemoryService` deleted. `IntegrityValidationService` updated to accept a `MemoryQueryService` interface (or null, defaulting to a no-op stub). The service is not instantiated at runtime.
3. No DB schema migration required — `workflow_result` is already in the `semantic_memory_type_check` constraint.

**Deferred (follow-up work):**
- `services/memory/MemoryService.ts` consolidation into `packages/memory/semantic` — deferred because it has no external callers and the type vocabulary alignment requires careful mapping.
- Vector search path: `SupabaseMemoryBackend.retrieve()` currently uses `findByOrganization` (full scan). Wiring `searchByEmbedding` requires embedding generation at query time — deferred to when the embedding pipeline is active.

---

## Consequences

- `packages/memory` is now a real consumer in the agent execution path.
- Agent memory writes go through `SupabaseSemanticStore` → `semantic_memory` table with full tenant isolation.
- `MemorySystem` remains the in-process L1 cache — agents do not change.
- `AgentMemoryService` (620 LOC, own schema, own types) is removed.

---

## Invariants

- Every memory write MUST include `organization_id`. `SupabaseMemoryBackend.store()` throws if `organization_id` is absent.
- Every memory read MUST include `organization_id`. `SupabaseMemoryBackend.retrieve()` throws if absent.
- `MemorySystem.clear()` is a no-op for persistent storage — use `SupabaseSemanticStore` directly for explicit cleanup.
