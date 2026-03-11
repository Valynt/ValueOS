# ADR-0014 — Direct Agent Invocation Rule

**Status:** Accepted  
**Date:** 2026-06-10  
**Deciders:** Engineering

---

## Context

The workflow execution path was:

```
api/workflow.ts
  → ExecutionRuntime
    → QueryExecutor
      → AgentAPI.invokeAgent()          ← HTTP client
        → fetch("http://localhost:3001/api/agents/...")  ← self-call
          → api/agents.ts
            → AgentFactory.create()
              → BaseAgent.execute()
```

The direct path (used by `api/agents.ts` when Kafka is disabled) was:

```
api/agents.ts → AgentFactory.create() → BaseAgent.execute()
```

The workflow path added 5 extra layers and an HTTP round-trip to the same process to reach the same `BaseAgent.execute()` call. This created:
- A failure mode: self-call fails if port binding is wrong or during startup
- An untraceable execution path requiring a network hop to follow in a debugger
- Unnecessary latency on every workflow stage execution

---

## Decision

**Server-side orchestration calls `AgentFactory` directly. `AgentAPI` is for external/frontend callers only.**

`QueryExecutor` now:
1. Holds a lazy `AgentFactory` singleton (same pattern as `api/agents.ts`)
2. Calls `factory.create(agentType, orgId).execute(lifecycleCtx)` directly
3. Wraps `AgentOutput` into the `{ success, data, error, confidence }` shape expected by downstream policy checks

`AgentAPI` (the HTTP client in `services/AgentAPI.ts`) remains for:
- Frontend hooks calling `/api/agents/...`
- External service integrations
- `ArtifactComposer`'s SDUI generation methods (higher-level structured calls)

---

## Execution Path After This Change

```
api/workflow.ts
  → ExecutionRuntime
    → QueryExecutor
      → AgentFactory.create(agentType, orgId)
        → BaseAgent.execute(lifecycleCtx)
```

Both the direct path and the workflow path now converge at `AgentFactory → BaseAgent` with no network hop.

---

## Consequences

- Eliminates an HTTP round-trip on every workflow stage execution.
- Removes the self-call failure mode.
- The execution path is traceable in a single stack frame.
- `AgentAPI` import removed from `QueryExecutor`.
- An integration test (`execution-runtime.test.ts`) verifies `AgentFactory.create().execute()` is called without a network mock.

---

## Rule

> Server-side code that needs to invoke an agent MUST call `AgentFactory.create(agentType, orgId).execute(context)` directly.  
> `AgentAPI` MUST NOT be imported by server-side orchestration for intra-process agent invocation.

**Exception:** `ArtifactComposer` uses `AgentAPI` for SDUI-specific structured methods (`generateValueCase`, `generateRealizationDashboard`, `generateExpansionOpportunities`) that format responses for the frontend. These are not raw agent invocations — they are SDUI orchestration calls that may legitimately go through the HTTP layer. The raw `invokeAgent` fallback in `WorkflowRenderService` has been replaced with a direct factory call.
