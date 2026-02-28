# @valueos/agents

Agent runtime and orchestration for ValueOS.

## Structure

This package contains two distinct layers:

### Active library modules (used by `packages/backend`)

```
agents/
├── core/          # ValueCaseSaga, EvidenceTiering, ConfidenceScorer, IdempotencyGuard, DeadLetterQueue
├── orchestration/ # HypothesisLoop, RedTeamAgent, agent interfaces
├── tools/         # Tool interfaces and registry
├── evaluation/    # Agent evaluation harness
```

These modules are imported by `packages/backend` and are the active orchestration layer.



Production agent implementations live in `packages/backend/src/lib/agent-fabric/agents/`
and use `secureInvoke` with real LLM calls, Zod validation, and tenant-scoped memory.

## Testing

To run tests for the active library modules:

```bash
npx vitest run packages/agents/core --passWithNoTests
npx vitest run packages/agents/orchestration --passWithNoTests
```

## Import Rules

| Consumer | Can Import? |
|----------|-------------|
| `packages/backend` | ✅ Yes (`core/`, `orchestration/`, `tools/`, `evaluation/`) |
| `apps/*` | ❌ No |

## Dependencies

- `@valueos/memory` - for agent memory access
- `@valueos/infra` - for infrastructure (via memory)
