# @valueos/memory

Memory layer for ValueOS - first-class system for LLM and system memory.

## Structure

```
memory/
├── semantic/    # Facts & knowledge graph with contradiction detection
├── episodic/    # Immutable interaction history, importance-weighted retrieval
├── vector/      # Hybrid search (vector + BM25) with provenance attachment
├── provenance/  # Data lineage tracking ("CFO Defence")
├── lifecycle/   # TTL enforcement, consolidation, promotion rules
└── context-ledger/ # Redis-backed session scratchpad (24h rolling TTL)
```

## Import Rules

| Consumer | Can Import? |
|----------|-------------|
| `packages/agents` | ✅ Yes |
| `packages/backend` | ✅ Yes |
| `apps/*` | ❌ No |

## Dependencies

- `@valueos/infra` - for storage/database access
- `zod` - input validation at the edge
