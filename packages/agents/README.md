# @valueos/agents

Agent runtime and orchestration for ValueOS.

## Structure

The `packages/agents` directory contains individual agent implementations and shared core libraries.

```
agents/
├── base/          # Shared runtime, logger, metrics, and config
├── core/          # Agent definitions, base classes
├── orchestration/ # Multi-agent coordination
├── tools/         # Tool interfaces and registry
├── evaluation/    # Agent evaluation harness
├── research/      # Research Agent
├── expansion/     # Expansion Agent
├── opportunity/   # Opportunity Agent
└── [agent-name]/  # Other specific agents
```

## Agent Development

Each agent is a self-contained package that exposes an Express application and its core analyzer logic.

### Directory Structure

A typical agent package (e.g., `packages/agents/research`) should follow this structure:

```
research/
├── src/
│   ├── __tests__/      # Unit tests
│   │   └── research.test.ts
│   ├── index.ts        # Main entry point, Analyzer class, and Express app
│   └── [other-files]
├── package.json
├── tsconfig.json
└── README.md           # Agent-specific documentation
```

### Best Practices

1.  **Export Analyzer Class:** Always export the main analyzer class (e.g., `ResearchAnalyzer`) to allow for unit testing without spinning up the server.
2.  **Export App Instance:** Export the `app` instance created by `createServer` to allow for potential integration testing.
3.  **Unit Tests:** Implement comprehensive unit tests in `src/__tests__/`. Mock external dependencies like `@valueos/agents/base` (logger, metrics) to test logic in isolation.
4.  **Documentation:** Include a `README.md` in the agent's root directory describing capabilities, configuration, and API usage.
5.  **Input Validation:** Use `zod` schemas to validate incoming requests.

## Testing

To run tests for a specific agent:

```bash
npx vitest run packages/agents/[agent-name]
```

To run all agent tests:

```bash
npx vitest run packages/agents
```

## Import Rules

| Consumer | Can Import? |
|----------|-------------|
| `packages/backend` | ✅ Yes (to run agents) |
| `apps/*` | ❌ No |

## Dependencies

- `@valueos/memory` - for agent memory access
- `@valueos/infra` - for infrastructure (via memory)
