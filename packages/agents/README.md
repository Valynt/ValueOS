# @valueos/agents

Agent runtime and orchestration for ValueOS.

## Structure

```
agents/
├── base/          # Shared runtime, logger, metrics, and config
├── core/          # Saga state machine, evidence tiering, confidence scoring, idempotency, DLQ
├── orchestration/ # HypothesisLoop, RedTeamAgent
├── tools/         # Tool interfaces and registry
└── evaluation/    # Agent evaluation harness and datasets
```

## Deprecated: Standalone Microservice Agents

> **The following subdirectories are deprecated and will be removed in a future release.**
> They contain standalone Express-based agent microservices that were an early
> architectural prototype. The production agent implementations live in
> `packages/backend/src/lib/agent-fabric/agents/` and run inside the unified
> backend process — not as separate microservices.
>
> These directories are **not imported by any production code**, are not started
> by any compose file, and most return mock/hardcoded data.
>
> **Deprecated directories:**
> `benchmark/`, `communicator/`, `company-intelligence/`, `coordinator/`,
> `expansion/`, `financial-modeling/`, `groundtruth/`, `integrity/`,
> `intervention-designer/`, `narrative/`, `opportunity/`, `outcome-engineer/`,
> `realization/`, `research/`, `system-mapper/`, `target/`, `value-eval/`,
> `value-mapping/`
>
> **Do not add new code to these directories.** If you need a new agent, add it
> to `packages/backend/src/lib/agent-fabric/agents/` following the `BaseAgent`
> pattern documented in `AGENTS.md`.

## Active Exports

Only the following subpaths are exported and consumed by `packages/backend`:

| Export path | Contents |
|---|---|
| `./core` | `ValueCaseSaga`, `EvidenceTiering`, `ConfidenceScorer`, `IdempotencyGuard`, `DeadLetterQueue` |
| `./orchestration` | `HypothesisLoop`, `RedTeamAgent` |
| `./tools` | Tool interfaces and registry |
| `./evaluation` | Agent evaluation harness |
| `./base` | Shared runtime (logger, metrics, config, health) |

## Testing

```bash
# Run tests for active modules
npx vitest run packages/agents/core --passWithNoTests
npx vitest run packages/agents/orchestration --passWithNoTests

# Run all agent tests (includes deprecated — will be removed)
npx vitest run packages/agents --passWithNoTests
```

## Import Rules

| Consumer | Can Import? |
|----------|-------------|
| `packages/backend` | Yes (core, orchestration, tools, evaluation, base) |
| `apps/*` | No |

## Dependencies

- `@valueos/agent-base` — shared runtime
- `@valueos/memory` — agent memory access (peer)
- `@valueos/infra` — infrastructure (peer, via memory)
