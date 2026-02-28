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

### Deprecated standalone microservices

> **DEPRECATED:** The standalone Express microservices below are superseded by the
> agent-fabric implementations in `packages/backend/src/lib/agent-fabric/agents/`.
> They use mock data, are not referenced by active CI, and have no consumers.
> Do not add new functionality here — implement new agents in the agent-fabric.

```
agents/
├── base/                  # Shared Express runtime (only used by standalone services)
├── benchmark/             # ⛔ Deprecated — uses mock data
├── communicator/          # ⛔ Deprecated — uses mock data
├── company-intelligence/  # ⛔ Deprecated — uses mock data
├── coordinator/           # ⛔ Deprecated — uses mock data
├── expansion/             # ⛔ Deprecated — uses mock data
├── financial-modeling/    # ⛔ Deprecated — uses mock data
├── groundtruth/           # ⛔ Deprecated — uses mock data
├── integrity/             # ⛔ Deprecated — uses mock data
├── intervention-designer/ # ⛔ Deprecated — uses mock data
├── narrative/             # ⛔ Deprecated — uses mock data
├── opportunity/           # ⛔ Deprecated — uses mock data
├── outcome-engineer/      # ⛔ Deprecated — uses mock data
├── realization/           # ⛔ Deprecated — uses mock data
├── research/              # ⛔ Deprecated — uses mock data
├── system-mapper/         # ⛔ Deprecated — uses mock data
├── target/                # ⛔ Deprecated — uses mock data
├── value-eval/            # ⛔ Deprecated — uses mock data
└── value-mapping/         # ⛔ Deprecated — uses mock data
```

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
