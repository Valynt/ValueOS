# Background Test Optimization Agent (BTOA)

This agent continuously inspects changesets and CI signals to generate and recommend test improvements. The YAML manifest is available at `blueprint/agents/background_test_optimization_agent.yaml` and the agent prompt is in `prompt.md`.

How to use:

1. The agent subscribes to events like `events.git.diff.pushed` and `events.ci.coverage.reported`.

2. The runtime invokes the agent's entrypoint, which uses `secureInvoke()` to call LLMs with the provided prompt.

3. The agent publishes recommendations to `events.tests.improvement.recommended` as machine-readable JSON.

Integration:

- Add the agent manifest to deployment manifests or registry if your orchestrator requires it.

- Implement the production-grade agent using the `apps/ValyntApp/src/lib/agent-fabric/agents/BackgroundTestOptimizationAgent.ts` skeleton and add tests for the agent's core logic.

See also: blueprint/agents for other manifests and patterns.
