---
name: value-graph-integration
description: >
  How agents read from and write to the ValueOS Value Graph via ValueGraphService
  and BaseGraphWriter. Use when adding Value Graph integration to an agent,
  debugging silent graph write failures, or reviewing agent graph output.
  Triggers on: "value graph", "graph integration", "BaseGraphWriter",
  "write to graph", "graph nodes", "graph edges", "opportunity graph",
  "ValueGraphService", "graph write failing".
---

<!-- ValueOS System Intent
ValueOS is a system of intelligence that structures, validates, and operationalizes
business value across the full lifecycle, producing CFO-defensible, evidence-backed outcomes.
Full policy: docs/AGENTS.md -->

# Value Graph Integration

The Value Graph is the canonical economic model for an opportunity. It connects customer use cases to quantified economic outcomes via a typed, evidence-linked edge structure. Agents write to it; the UI and API read from it.

## Files

| File | Purpose |
|---|---|
| `packages/backend/src/lib/agent-fabric/BaseGraphWriter.ts` | Composable utility for agents — enforces the three write invariants |
| `packages/backend/src/services/value-graph/ValueGraphService.ts` | Core service — read and write operations, all tenant-scoped |

## Graph node types

| Node type | Table | Represents |
|---|---|---|
| `VgCapability` | `vg_capabilities` | A product capability that enables a use case |
| `VgMetric` | `vg_metrics` | A measurable KPI affected by a capability |
| `VgValueDriver` | `vg_value_drivers` | An economic outcome (revenue, cost, risk) |
| `UseCase` | `use_cases` | A customer use case (source node) |

Edges connect these nodes with typed relationships and confidence scores.

## Using BaseGraphWriter in an agent

Agents already extend `BaseAgent` — use composition, not inheritance:

```typescript
import { BaseGraphWriter } from "../../lib/agent-fabric/BaseGraphWriter.js";

class NarrativeAgent extends BaseAgent {
  private readonly graphWriter = new BaseGraphWriter();

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    // Step 1: Extract and validate context — throws if invalid
    const { opportunityId, organizationId } = this.graphWriter.getSafeContext(context);

    // Step 2: Generate stable node IDs
    const capabilityId = this.graphWriter.generateNodeId();
    const metricId = this.graphWriter.generateNodeId();

    // Step 3: Write nodes atomically — one failure does not abort others
    const result = await this.graphWriter.safeWriteBatch([
      () => this.graphWriter.writeCapability(context, {
        name: "Automated Invoice Processing",
        description: "Reduces manual AP touchpoints",
        category: "automation",
      }),
      () => this.graphWriter.writeMetric(context, {
        name: "Days Payable Outstanding",
        unit: "days",
        baseline_value: 45,
        target_value: 30,
        impact_timeframe_months: 6,
      }),
      () => this.graphWriter.writeValueDriver(context, {
        type: "cost_reduction",
        name: "AP Labor Cost Reduction",
        description: "Reduced FTE hours in accounts payable",
        estimated_impact_usd: 180000,
      }),
    ]);

    if (result.failed > 0) {
      // Surface partial failure — do not silently swallow
      logger.warn("NarrativeAgent: partial graph write failure", { result });
    }

    return this.buildOutput(context, { /* ... */ });
  }
}
```

## The three write invariants (enforced by BaseGraphWriter)

### Invariant 1 — Canonical context extraction

`getSafeContext(context)` extracts `opportunity_id` and `organization_id` and validates both as UUID v4. It throws `LifecycleContextError` if either is absent or invalid.

**Context key lookup order for `opportunity_id`:**
1. `context.user_inputs["opportunity_id"]`
2. `context.metadata["opportunity_id"]`
3. Throws — never falls back to `workspace_id` or any other key

```typescript
// ✅ Correct — opportunity_id in user_inputs
const context: LifecycleContext = {
  organization_id: "uuid-v4-here",
  user_inputs: { opportunity_id: "uuid-v4-here" },
  // ...
};

// ❌ Wrong — workspace_id is not opportunity_id
const context: LifecycleContext = {
  organization_id: "uuid-v4-here",
  workspace_id: "some-id",  // getSafeContext will throw
  // ...
};
```

### Invariant 2 — Safe UUID generation

`generateNodeId()` always returns a valid UUID v4. Raw string fallbacks (e.g. `"capability-1"`) must never reach UUID Postgres columns.

```typescript
// ✅ Always use generateNodeId for new node IDs
const id = this.graphWriter.generateNodeId();

// ✅ Pass an existing UUID to get it back unchanged (idempotent)
const id = this.graphWriter.generateNodeId(existingUuid);

// ❌ Never pass raw strings to UUID columns
const id = "capability-" + agentName;  // will crash on DB insert
```

### Invariant 3 — Atomic write isolation

`safeWriteBatch()` uses `Promise.allSettled` — one failed write does not abort the remaining writes. Always check `result.failed` and surface partial failures.

```typescript
const result = await this.graphWriter.safeWriteBatch([...]);
if (result.failed > 0) {
  // Log and surface — do not silently ignore
  logger.warn("partial graph write failure", { result });
}
```

## Reading the graph (API / service layer)

The `ValueGraphService` read methods are for API handlers and the UI — not for agents during execution:

```typescript
import { valueGraphService } from "../../services/value-graph/ValueGraphService.js";

// Load full graph for an opportunity
const graph = await valueGraphService.getGraphForOpportunity(opportunityId, organizationId);

// Get ordered value paths (UseCase → Capability → Metric → ValueDriver)
const paths = await valueGraphService.getValuePaths(opportunityId, organizationId);
```

All read operations are tenant-scoped — `organization_id` is required.

## Tenant isolation

Every graph operation must include `organization_id`. `BaseGraphWriter` injects it automatically from `context.organization_id`. Direct `ValueGraphService` calls must pass it explicitly.

```typescript
// ✅ BaseGraphWriter injects organization_id automatically
await this.graphWriter.writeCapability(context, { name: "...", ... });

// ✅ Direct service call — pass organization_id explicitly
await valueGraphService.writeCapability({
  opportunity_id: opportunityId,
  organization_id: organizationId,  // REQUIRED
  name: "...",
  // ...
});

// ❌ Missing organization_id — data leak
await valueGraphService.writeCapability({ opportunity_id: opportunityId, name: "..." });
```

## Do not proceed if

- `context.organization_id` is not a valid UUID v4 — `getSafeContext` will throw; fix the caller
- `context.user_inputs.opportunity_id` is absent — the agent cannot write to the correct opportunity
- You are calling `valueGraphService` write methods directly from an agent — use `BaseGraphWriter` instead to enforce the invariants

## Anti-patterns

| Pattern | Fix |
|---|---|
| `context.workspace_id` used as `opportunity_id` | Use `context.user_inputs["opportunity_id"]` |
| Raw string node IDs (`"capability-1"`) | Use `this.graphWriter.generateNodeId()` |
| `Promise.all` for graph writes | Use `safeWriteBatch` — one failure should not abort others |
| Calling `valueGraphService.writeCapability` directly from an agent | Use `this.graphWriter.writeCapability(context, ...)` |
| Ignoring `result.failed` from `safeWriteBatch` | Always check and log partial failures |
| Missing `organization_id` in direct service calls | Always pass `organization_id` — it is required for tenant isolation |

## Completion report

After adding Value Graph integration to an agent:

```
Agent updated:    packages/backend/src/lib/agent-fabric/agents/XAgent.ts
BaseGraphWriter:  composed as private readonly graphWriter = new BaseGraphWriter()
getSafeContext:   called before any write — throws on invalid context
safeWriteBatch:   used for all writes — partial failure handled
Tests updated:    packages/backend/src/lib/agent-fabric/agents/__tests__/XAgent.test.ts
Commands run:     pnpm test -- ...XAgent.test.ts  →  X passed
                  pnpm run lint  →  no errors
Unresolved:       [any open items]
```
