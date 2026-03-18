---
name: memory-query
description: |
  Use when the user asks to read from, write to, or query agent memory, or when
  an agent needs to retrieve prior context, store results for downstream agents,
  or search for related knowledge. Handles requests like "retrieve hypotheses
  from memory", "store KPI targets for the next agent", "search memory for
  stakeholder data", "add a semantic memory entry", or "query the vector store".
  Covers which memory layer to use, correct tenant-scoped query patterns, and
  the distinction between in-process MemorySystem and the persistent
  packages/memory subsystem.
---

# Memory Query

Two memory layers exist. Use the right one — they are not interchangeable.

## Which layer to use

| Situation | Layer | Import |
|---|---|---|
| Agent reading/writing during a single execution | `MemorySystem` | `packages/backend/src/lib/agent-fabric/MemorySystem.ts` |
| Cross-session recall, vector search, provenance | `packages/memory` | `@valueos/memory` |
| Frontend consumers | ❌ Forbidden | `packages/memory` is backend-only |

When in doubt, use `MemorySystem` — it handles persistence automatically via its backend when configured.

## Layer 1: MemorySystem (in-process, agent fabric)

Used inside agent `execute()` methods via `this.memorySystem`.

### Reading

```typescript
const memories = await this.memorySystem.retrieve({
  agent_id: "opportunity",        // which agent wrote the data
  workspace_id: context.workspace_id,
  organization_id: context.organization_id, // REQUIRED — tenant isolation
  memory_type: "semantic",        // optional filter
  limit: 10,
  min_importance: 0.5,            // optional quality filter
});
```

`organization_id` is required. `retrieve()` throws if it is missing.

### Writing

```typescript
await this.memorySystem.storeSemanticMemory(
  context.workspace_id,   // sessionId
  this.name,              // agentId
  "episodic",             // type: "episodic" | "semantic" | "procedural" | "working"
  "Content string",       // content
  {
    type: "my_result",
    organization_id: context.organization_id, // include in metadata
  },
  this.organizationId,    // REQUIRED last arg — write scope for tenant isolation
);
```

See [references/memory-patterns.ts](references/memory-patterns.ts) for copy-ready examples.

### Memory types

| Type | Use for |
|---|---|
| `"semantic"` | Facts, hypotheses, KPI targets — shared across agents |
| `"episodic"` | Agent invocation records, intermediate results |
| `"procedural"` | Learned patterns, reusable strategies |
| `"working"` | Short-lived scratchpad data within a single execution |

## Layer 2: packages/memory (persistent, cross-session)

Used for vector search, provenance tracking, and cross-session recall.
Import from `@valueos/memory`. Forbidden in `apps/*` (frontend).

The API is **class-based** — instantiate `VectorMemory` or `SemanticMemory` with a store
implementation, then call methods on the instance. There are no free-function exports.

### Vector / hybrid search

```typescript
import { VectorMemory, type HybridSearchOptions } from "@valueos/memory";

// vectorMemory is injected or constructed with a VectorStore implementation
const results = await vectorMemory.hybridSearch({
  queryText: "procurement cost reduction",
  queryEmbedding: embedding,    // number[1536] — generate via LLM embedding API
  tenantId: organizationId,     // REQUIRED — tenant isolation
  limit: 10,
  attachProvenance: true,       // include confidence chain
} satisfies HybridSearchOptions);
```

`hybridSearch` requires a pre-computed embedding (`queryEmbedding: number[1536]`).
Vector search uses 70/30 vector/BM25 weighting by default — do not override without reason.

### Semantic memory (persistent facts)

```typescript
import { SemanticMemory, type SemanticFactInput } from "@valueos/memory";

// semanticMemory is injected or constructed with a SemanticStore implementation
await semanticMemory.store({
  type: "hypothesis",           // SemanticFactType
  content: "...",
  embedding: embedding,         // number[1536]
  organizationId,               // REQUIRED — tenant isolation
  confidenceScore: 0.8,
  metadata: {},
} satisfies SemanticFactInput);

const results = await semanticMemory.search({
  embedding,                    // number[1536]
  organizationId,               // REQUIRED
  limit: 10,
});
```

## Tenant isolation rules

- Every `retrieve()` call: `organization_id: context.organization_id`
- Every `storeSemanticMemory()` call: `this.organizationId` as last argument
- Every vector/hybrid search: `tenantId: organizationId`
- Never query without a tenant scope — this is a data leak

## Do not proceed if

- `organization_id` / `tenantId` is absent from the query — stop and add it
- Code imports `@valueos/memory` from a frontend app — forbidden
- An agent calls `this.memorySystem.retrieve()` without `organization_id` — `retrieve()` will throw at runtime

## Anti-patterns

| Pattern | Fix |
|---|---|
| `retrieve({ agent_id, workspace_id })` — no `organization_id` | Add `organization_id: context.organization_id` |
| `storeSemanticMemory(..., metadata)` — missing last arg | Pass `this.organizationId` as the 6th argument |
| Using `packages/memory` vector search inside an agent for same-session data | Use `MemorySystem.retrieve()` instead |
| Using `MemorySystem` for cross-session recall | Use `packages/memory` with a persistence backend |
| Importing `@valueos/memory` in `apps/*` | Move the call to a backend service |
