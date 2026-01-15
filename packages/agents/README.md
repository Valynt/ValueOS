# @valueos/agents

Agent runtime and orchestration for ValueOS.

## Structure

```
agents/
├── core/          # Agent definitions, base classes
├── orchestration/ # Multi-agent coordination
├── tools/         # Tool interfaces and registry
└── evaluation/    # Agent evaluation harness
```

## Import Rules

| Consumer | Can Import? |
|----------|-------------|
| `packages/backend` | ✅ Yes (to run agents) |
| `apps/*` | ❌ No |

## Dependencies

- `@valueos/memory` - for agent memory access
- `@valueos/infra` - for infrastructure (via memory)
