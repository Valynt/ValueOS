# @valueos/memory

Memory layer for ValueOS - first-class system for LLM and system memory.

## Structure

```
memory/
├── semantic/    # Semantic memory (facts, knowledge)
├── episodic/    # Episodic memory (events, interactions)
├── vector/      # Vector store adapters (embeddings)
└── provenance/  # Memory provenance tracking
```

## Import Rules

| Consumer | Can Import? |
|----------|-------------|
| `packages/agents` | ✅ Yes |
| `packages/backend` | ✅ Yes |
| `apps/*` | ❌ No |

## Dependencies

- `@valueos/infra` - for storage/database access
