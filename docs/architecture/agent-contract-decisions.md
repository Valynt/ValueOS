# Agent Contract Decisions

This document records architectural decisions about the agent fabric contract.
All exceptions to the standard agent contract (`extends BaseAgent`, `secureInvoke`) must be recorded here.

---

## §1 — DiscoveryAgent: Orchestration-Only Exception

**Date:** 2026-04-05
**Status:** Accepted
**Decision Makers:** Platform Engineering

### Context

The `enforce-base-agent-compliance.js` CI script requires all agents to extend `BaseAgent` and use `secureInvoke` for LLM calls. `DiscoveryAgent` does not extend `BaseAgent`.

### Decision

`DiscoveryAgent` is classified as an **orchestration agent**, not an LLM agent. It:

1. Does not make direct LLM calls
2. Delegates all LLM reasoning to `OpportunityAgent` (which extends `BaseAgent` and uses `secureInvoke`)
3. Coordinates the discovery workflow by emitting domain events via `DomainEventBus`
4. Manages run state in an in-memory store (not domain state)

### Consequences

- `DiscoveryAgent` is added to `ALLOWED_EXCEPTIONS` in `enforce-base-agent-compliance.js`
- Any future change that adds LLM calls to `DiscoveryAgent` MUST refactor it to extend `BaseAgent` and use `secureInvoke`
- A lint rule should be added to detect `import.*LLMGateway` in `DiscoveryAgent.ts` as a violation

### Alternatives Considered

**Refactor DiscoveryAgent to extend BaseAgent:** Rejected. The `BaseAgent` constructor requires `AgentConfig`, `MemorySystem`, `LLMGateway`, and `CircuitBreaker`. Injecting these into an orchestration agent that never uses them adds unnecessary coupling and makes the dependency graph misleading.

---

## §2 — Zod Schema Requirement for LLM Agents

**Date:** 2026-04-05
**Status:** Accepted

### Context

The CI script warns when LLM agents (`FinancialModelingAgent`, `IntegrityAgent`, `NarrativeAgent`, `OpportunityAgent`) do not define Zod schemas for their output validation.

### Decision

All LLM agents that extend `BaseAgent` MUST define a Zod schema for their primary output type. The schema must be used in `_execute()` to validate the LLM response before returning it. This is enforced as a WARNING (not a build blocker) until all agents are migrated.

### Migration Plan

| Agent | Status | Target Sprint |
|-------|--------|---------------|
| `FinancialModelingAgent` | Needs Zod output schema | Sprint 3 |
| `IntegrityAgent` | Needs Zod output schema | Sprint 3 |
| `NarrativeAgent` | Needs Zod output schema | Sprint 3 |
| `OpportunityAgent` | Needs Zod output schema | Sprint 3 |

Once all agents are migrated, the WARNING will be promoted to a CRITICAL violation.
