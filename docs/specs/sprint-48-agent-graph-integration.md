# Spec: Sprint 48 — Value Graph Agent Integration (Phases 1–2)

**Sprint:** 48  
**Depends on:** Sprint 47 (`feat/sprint-47-value-graph`, merged)  
**Baseline:** `ValueGraphService` exists with `writeCapability`, `writeMetric`, `writeValueDriver`, `writeEdge`, `getValuePaths`. Four DB tables live with RLS.

---

## Problem Statement

The Value Graph schema and service exist (Sprint 47), but no agent writes to it. Agents still reason with free-text descriptions and ad-hoc shapes. Until agents populate the graph, `getValuePaths` always returns an empty array and the ontology provides no value.

Sprint 48 wires the three agents that form the core of the value lifecycle into the graph:

- **`OpportunityAgent`** — discovers use cases and capabilities; maps hypothesis categories to the fixed `VgValueDriverType` taxonomy
- **`FinancialModelingAgent`** — resolves metrics and maps them to value drivers; augments existing ROI output with graph writes
- **`IntegrityAgent`** — reads the graph after the above two agents run; flags `hypothesis_claims_metric` edges that have no supporting `evidence_supports_metric` counterpart

---

## Scope

### In Scope

- `BaseAgent`: add optional `valueGraphService` constructor parameter (6th position)
- `OpportunityAgent`: write `VgCapability` nodes, `VgValueDriver` nodes, `use_case_enabled_by_capability` edges, and `hypothesis_claims_metric` edges after hypothesis generation
- `FinancialModelingAgent`: write `VgMetric` nodes, `capability_impacts_metric` edges, and `metric_maps_to_value_driver` edges after ROI computation; existing ROI calculation unchanged
- `IntegrityAgent`: read graph after validation; flag `hypothesis_claims_metric` edges with no `evidence_supports_metric` counterpart; surface gaps in agent output metadata
- Integration tests for each agent verifying graph writes and reads
- Existing agent tests must pass without modification

### Out of Scope

- `NarrativeAgent`, `TargetAgent`, `RealizationAgent`, `ExpansionAgent`, `ComplianceAuditorAgent` (Sprint 49)
- API endpoints for the graph (Sprint 49)
- UI (Sprint 50)
- Replacing the existing ROI economic kernel with graph-derived paths (deferred)

---

## Requirements

### 1. `BaseAgent` — Optional `ValueGraphService` Parameter

Add `valueGraphService` as an optional 6th constructor parameter:

```typescript
constructor(
  config: AgentConfig,
  organizationId: string,
  memorySystem: MemorySystem,
  llmGateway: LLMGateway,
  circuitBreaker: CircuitBreaker,
  valueGraphService?: ValueGraphService   // NEW — optional, defaults to module singleton
)
```

- If not provided, defaults to the `valueGraphService` singleton exported from `packages/backend/src/services/value-graph/ValueGraphService.ts`
- Stored as `protected valueGraphService: ValueGraphService`
- All existing instantiation sites (tests, e2e, services) continue to work without change — the parameter is optional

### 2. `OpportunityAgent` — Graph Writes

After `secureInvoke` completes and hypotheses are stored in memory, `OpportunityAgent` must write to the Value Graph. This is a **fire-and-forget post-step** — graph write failures must be caught and logged, never propagated to the caller.

#### 2.1 Category → `VgValueDriverType` mapping

The agent's LLM output uses free-text `category` values on hypotheses. Map them to the fixed taxonomy:

| LLM category | `VgValueDriverType` |
|---|---|
| `revenue_growth` | `revenue_growth` |
| `revenue` | `revenue_growth` |
| `cost_reduction` | `cost_reduction` |
| `cost_savings` | `cost_reduction` |
| `operational_efficiency` | `cost_reduction` |
| `risk_mitigation` | `risk_mitigation` |
| `risk` | `risk_mitigation` |
| `capital_efficiency` | `capital_efficiency` |
| `strategic_advantage` | `cost_reduction` (fallback) |
| anything else | `cost_reduction` (fallback) |

#### 2.2 Nodes to write

For each hypothesis in the LLM output:

1. **`VgCapability` node** — one per hypothesis:
   - `name`: `hypothesis.title`
   - `description`: `hypothesis.description`
   - `category`: `"other"` (OpportunityAgent lacks context to classify capability type; FinancialModelingAgent may refine)
   - `opportunity_id`: `context.value_case_id`
   - `organization_id`: `this.organizationId`

2. **`VgValueDriver` node** — one per hypothesis:
   - `type`: mapped `VgValueDriverType`
   - `name`: `hypothesis.title`
   - `description`: `hypothesis.description`
   - `opportunity_id`: `context.value_case_id`
   - `organization_id`: `this.organizationId`

#### 2.3 Edges to write

For each hypothesis, after writing both nodes:

1. **`use_case_enabled_by_capability`** edge: `UseCase → VgCapability`
   - `from_entity_type`: `"use_case"`
   - `from_entity_id`: `context.value_case_id` (proxy — use case IDs are not yet resolved at this stage)
   - `to_entity_type`: `"vg_capability"`
   - `to_entity_id`: the newly written capability's `id`
   - `confidence_score`: mapped from `hypothesis.confidence` (`high=0.9`, `medium=0.7`, `low=0.5`)
   - `created_by_agent`: `"OpportunityAgent"`

2. **`hypothesis_claims_metric`** edge: `ValueHypothesis → VgValueDriver`
   - `from_entity_type`: `"value_hypothesis"`
   - `from_entity_id`: hypothesis ID (use the memory key or a deterministic UUID derived from `opportunityId + hypothesis.title`)
   - `to_entity_type`: `"vg_value_driver"`
   - `to_entity_id`: the newly written value driver's `id`
   - `confidence_score`: same as above
   - `created_by_agent`: `"OpportunityAgent"`

#### 2.4 Failure handling

Wrap all graph writes in a single `try/catch`. On error: log with `logger.warn` including `opportunityId` and `organizationId`. Never throw. The agent's primary output (hypotheses) must be returned regardless.

#### 2.5 `opportunity_id` sourcing

Use `context.value_case_id` as `opportunity_id` for all graph writes.

### 3. `FinancialModelingAgent` — Graph Writes

After `secureInvoke` completes and ROI models are computed, `FinancialModelingAgent` writes to the Value Graph. Same fire-and-forget pattern — failures logged, never propagated.

#### 3.1 Nodes to write

For each computed ROI model in the output:

1. **`VgMetric` node** — one per model:
   - `name`: `model.metric_name` (or equivalent field — check actual LLM output shape)
   - `unit`: map from model unit string → `VgMetricUnit` (`"usd"`, `"percent"`, `"hours"`, `"headcount"`, `"days"`, `"count"`, `"score"`); default to `"usd"` if unrecognised
   - `baseline_value`: `model.baseline_value` if present, else `null`
   - `target_value`: `model.target_value` if present, else `null`
   - `impact_timeframe_months`: derive from `model.time_horizon` if present, else `null`
   - `opportunity_id`: `context.value_case_id`
   - `organization_id`: `this.organizationId`

#### 3.2 Edges to write

For each ROI model, after writing the `VgMetric` node:

1. **`capability_impacts_metric`** edge: `VgCapability → VgMetric`
   - Look up `VgCapability` nodes for this opportunity (query `vg_capabilities` by `opportunity_id` + `organization_id`)
   - Match by name: find the capability whose `name` most closely matches `model.metric_name` or `model.capability_name`; if no match, use the first capability returned
   - If no capability nodes found at all: skip this edge, log `logger.warn`
   - `confidence_score`: `model.confidence` mapped to float (same `high/medium/low` mapping)
   - `created_by_agent`: `"FinancialModelingAgent"`

2. **`metric_maps_to_value_driver`** edge: `VgMetric → VgValueDriver`
   - Look up `VgValueDriver` nodes for this opportunity
   - Map `model.value_driver_type` (or `model.category`) to `VgValueDriverType` using the same mapping table
   - Match by type: find the value driver whose `type` matches the mapped type
   - If no matching value driver found: write a new `VgValueDriver` node first, then write the edge
   - `confidence_score`: same as above
   - `created_by_agent`: `"FinancialModelingAgent"`

#### 3.3 Existing output unchanged

The `AgentOutput` shape, ROI calculation, NPV computation, and memory storage are not modified. Graph writes are purely additive side effects.

### 4. `IntegrityAgent` — Graph Read + Gap Flagging

After `IntegrityAgent` completes its existing validation pass, it reads the Value Graph and checks for structural gaps. Same fire-and-forget pattern for the graph read — failures logged, never propagated.

#### 4.1 Gap detection

Query the graph for the current opportunity:

1. Find all edges of type `hypothesis_claims_metric` (written by `OpportunityAgent`)
2. For each such edge, check whether any `evidence_supports_metric` edge exists with the same `to_entity_id`
3. If no supporting evidence edge exists → this is a **gap**

#### 4.2 Output augmentation

Add a `graph_integrity_gaps` field to `IntegrityAgent`'s `AgentOutput.metadata`:

```typescript
graph_integrity_gaps: Array<{
  hypothesis_claims_edge_id: string;
  from_entity_id: string;   // ValueHypothesis ID
  to_entity_id: string;     // VgValueDriver ID
  gap_type: "missing_evidence_support";
}>
```

- If no gaps: `graph_integrity_gaps: []`
- If graph read fails: `graph_integrity_gaps: []` (failure is logged, not surfaced)
- Log a `logger.warn` for each gap found, including `opportunityId` and entity IDs

#### 4.3 No writes

`IntegrityAgent` does not write to the graph in Sprint 48. Write of `evidence_supports_metric` edges is deferred to Sprint 53.

---

## Acceptance Criteria

- [ ] `BaseAgent` constructor accepts optional 6th `valueGraphService` parameter; all existing instantiation sites compile without change
- [ ] `OpportunityAgent` writes `VgCapability` + `VgValueDriver` nodes and `use_case_enabled_by_capability` + `hypothesis_claims_metric` edges after a successful run
- [ ] `OpportunityAgent` graph write failure does not affect primary output or throw
- [ ] `FinancialModelingAgent` writes `VgMetric` nodes and `capability_impacts_metric` + `metric_maps_to_value_driver` edges after a successful run
- [ ] `FinancialModelingAgent` existing ROI output shape is unchanged
- [ ] `FinancialModelingAgent` graph write failure does not affect primary output or throw
- [ ] `IntegrityAgent` reads graph after validation; populates `graph_integrity_gaps` in output metadata
- [ ] `IntegrityAgent` graph read failure does not affect primary output or throw
- [ ] All existing agent tests (`OpportunityAgent.test.ts`, `FinancialModelingAgent.test.ts`, `IntegrityAgent.test.ts`) pass without modification
- [ ] New integration tests verify graph writes for `OpportunityAgent` and `FinancialModelingAgent`
- [ ] New integration test verifies `IntegrityAgent` gap detection
- [ ] `pnpm test` green, `pnpm run check` green

---

## Implementation Approach

### Step 1 — `BaseAgent`: add optional `valueGraphService` parameter

**File:** `packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts`

- Import `ValueGraphService` type and `valueGraphService` singleton from `../../../services/value-graph/ValueGraphService.js`
- Add 6th optional constructor parameter `valueGraphService?: ValueGraphService`
- Store as `protected valueGraphService: ValueGraphService`
- Default: `this.valueGraphService = valueGraphService ?? importedSingleton`
- No other changes to `BaseAgent`

### Step 2 — `OpportunityAgent`: graph write post-step

**File:** `packages/backend/src/lib/agent-fabric/agents/OpportunityAgent.ts`

- Add private static helper `mapCategoryToValueDriverType(category: string): VgValueDriverType`
- Add private static helper `confidenceLevelToScore(level: ConfidenceLevel): number`
- Add private async method `writeHypothesesToGraph(hypotheses, context)` — wraps all writes in try/catch
- Call `writeHypothesesToGraph` at the end of `execute()`, after `storeHypotheses()`, before returning output
- Write order per hypothesis: capability node → value driver node → `use_case_enabled_by_capability` edge → `hypothesis_claims_metric` edge

### Step 3 — `FinancialModelingAgent`: graph write post-step

**File:** `packages/backend/src/lib/agent-fabric/agents/FinancialModelingAgent.ts`

- Add private static helper `mapUnitToVgMetricUnit(unit: string): VgMetricUnit`
- Add private async method `writeModelsToGraph(models, context)` — wraps all writes in try/catch
- For each model: write `VgMetric` node → look up existing capability/driver nodes → write edges
- Call `writeModelsToGraph` at the end of `execute()`, after existing memory storage, before returning output

### Step 4 — `IntegrityAgent`: graph read post-step

**File:** `packages/backend/src/lib/agent-fabric/agents/IntegrityAgent.ts`

- Define local `GraphIntegrityGap` interface (not exported)
- Add private async method `checkGraphIntegrityGaps(context): Promise<GraphIntegrityGap[]>` — wraps graph read in try/catch, returns `[]` on error
- Call after existing validation; attach result to `AgentOutput.metadata.graph_integrity_gaps`

### Step 5 — Integration tests

**New files:**
- `packages/backend/src/lib/agent-fabric/agents/__tests__/OpportunityAgent.graph.test.ts`
- `packages/backend/src/lib/agent-fabric/agents/__tests__/FinancialModelingAgent.graph.test.ts`
- `packages/backend/src/lib/agent-fabric/agents/__tests__/IntegrityAgent.graph.test.ts`

Each test file:
- Injects a mock `ValueGraphService` via the 6th constructor parameter
- Verifies the correct write/read methods are called with correct arguments
- Verifies failures in `ValueGraphService` do not propagate to the agent output
- Does not modify or import from existing `*.test.ts` files

### Step 6 — Verify

- `pnpm --filter @valueos/backend run typecheck` — no new errors
- `pnpm --filter @valueos/backend exec vitest run` — all tests pass including new graph tests
- Existing `OpportunityAgent.test.ts`, `FinancialModelingAgent.test.ts`, `IntegrityAgent.test.ts` pass without modification
