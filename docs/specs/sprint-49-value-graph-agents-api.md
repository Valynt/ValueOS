# Spec: Sprint 49 — Value Graph: Remaining Agents + API

**Sprint:** 49
**Depends on:** Sprint 48 (`feat/sprint-48-agent-graph-integration`, merged)
**Baseline:** `OpportunityAgent`, `FinancialModelingAgent`, `IntegrityAgent` write to the Value Graph. `ValueGraphService` exists with full read/write API. No HTTP endpoints for the graph exist yet.

---

## Problem Statement

Sprint 48 wired the three core agents to the Value Graph. Five agents remain unconnected: `NarrativeAgent`, `TargetAgent`, `RealizationAgent`, `ExpansionAgent`, and `ComplianceAuditorAgent`. Until they write to the graph, the ontology is incomplete — the lifecycle from hypothesis → KPI target → realization proof → narrative → expansion has no structural representation.

Additionally, the graph is currently an internal side-effect with no HTTP surface. The frontend (Sprint 50) and external consumers cannot query it.

Two structural risks from Sprint 48 must not be inherited:
1. **UUID drift** — `hypothesis.id` was a human-readable slug used as a DB UUID column. Fixed in Sprint 48 with `randomUUID()`, but the pattern must be enforced structurally.
2. **Semantic drift** — `hypothesis_claims_metric` pointed to `vg_value_driver`. Fixed by rename, but new agents could introduce the same mismatch silently.

Sprint 49 addresses all three gaps: remaining agent integration, API exposure, and structural guardrails.

---

## Scope

### In Scope

- **`BaseGraphWriter`** — shared class in `packages/backend/src/services/value-graph/` that encapsulates `opportunity_id` resolution, `randomUUID()` generation, and fire-and-forget error handling. All 5 new agents extend or compose it.
- **Zod edge validation guardrail** — compile-time enforcement of valid `(from_entity_type, edge_type, to_entity_type)` triples in `packages/shared`. Invalid combinations fail the build, not silently at runtime.
- **`NarrativeAgent`** — reads graph paths for context; writes `narrative_explains_hypothesis` edges
- **`TargetAgent`** — writes `VgMetric` nodes (upsert, refines FinancialModelingAgent drafts) and `target_quantifies_driver` edges
- **`RealizationAgent`** — writes `evidence_supports_metric` edges from proof points (closes the IntegrityAgent gap loop)
- **`ExpansionAgent`** — reads existing graph; writes `expansion_extends_node` edges for new use case opportunities
- **`ComplianceAuditorAgent`** — reads entire graph; writes `audit_verifies_node` edges with trust scores
- **Value Graph API** — 7 authenticated, tenant-scoped HTTP endpoints
- **OpenAPI spec** updated for all new endpoints
- Integration tests per agent (graph writes + fire-and-forget failure isolation)
- `pnpm test` green, `pnpm run check` green

### Out of Scope

- UI (Sprint 50)
- `ReasoningTrace` schema (Sprint 51)
- `ValueIntegrityService` contradiction detection (Sprint 53)
- Replacing the existing ROI economic kernel with graph-derived paths

---

## Requirements

### 1. Zod Edge Validation Guardrail

**File:** `packages/shared/src/domain/ValueGraphEdge.ts`

Define a compile-time-enforced allowlist of valid edge triples. Each entry specifies the only valid `(from_entity_type, to_entity_type)` pair for a given `edge_type`.

```typescript
export const EDGE_TYPE_CONSTRAINTS = {
  company_has_persona:               { from: 'account',          to: 'stakeholder'      },
  persona_executes_use_case:         { from: 'stakeholder',      to: 'use_case'         },
  use_case_enabled_by_capability:    { from: 'use_case',         to: 'vg_capability'    },
  capability_impacts_metric:         { from: 'vg_capability',    to: 'vg_metric'        },
  metric_maps_to_value_driver:       { from: 'vg_metric',        to: 'vg_value_driver'  },
  evidence_supports_metric:          { from: 'evidence',         to: 'vg_metric'        },
  hypothesis_claims_value_driver:    { from: 'value_hypothesis', to: 'vg_value_driver'  },
  narrative_explains_hypothesis:     { from: 'narrative',        to: 'value_hypothesis' },
  target_quantifies_driver:          { from: 'vg_metric',        to: 'vg_value_driver'  },
  realization_tracks_target:         { from: 'evidence',         to: 'vg_metric'        },
  expansion_extends_node:            { from: 'use_case',         to: 'vg_capability'    },
  audit_verifies_node:               { from: 'evidence',         to: 'vg_value_driver'  },
} as const satisfies Record<ValueGraphEdgeType, { from: ValueGraphEntityType; to: ValueGraphEntityType }>;
```

- Add new edge types to `ValueGraphEdgeTypeSchema` enum
- Add new entity types (`narrative`, `evidence` as first-class if not already present) to `ValueGraphEntityTypeSchema`
- Export `EDGE_TYPE_CONSTRAINTS` from the shared domain index
- `ValueGraphService.writeEdge` validates the triple at runtime using `EDGE_TYPE_CONSTRAINTS` and throws a typed `EdgeConstraintViolationError` if invalid — this surfaces in agent logs immediately rather than as a silent DB error

**DB migration:** Add new edge type values to the `value_graph_edges.edge_type` CHECK constraint. New migration file: `20260919000000_value_graph_edge_types.sql` with rollback.

### 2. `BaseGraphWriter`

**File:** `packages/backend/src/services/value-graph/BaseGraphWriter.ts`

Abstract class that all 5 new agents compose (not extend — agents already extend `BaseAgent`). Encapsulates the three patterns fixed in Sprint 48:

```typescript
export class BaseGraphWriter {
  constructor(
    protected readonly valueGraphService: ValueGraphService,
    protected readonly logger: Logger,
  ) {}

  /** Resolves opportunity_id from context using the canonical value_case_id key. */
  protected resolveOpportunityId(context: LifecycleContext): string | undefined {
    return (context.user_inputs?.value_case_id as string | undefined)
      ?? context.workspace_id;
  }

  /** Returns a fresh UUID for use as from_entity_id on graph edges. */
  protected newEntityId(): string {
    return randomUUID();
  }

  /**
   * Wraps a graph write operation in fire-and-forget error handling.
   * Failures are logged with context; never propagated.
   */
  protected async safeWrite<T>(
    operation: () => Promise<T>,
    context: { opportunityId: string; organizationId: string; agentName: string },
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (err) {
      this.logger.warn(`${context.agentName}: graph write failed`, {
        opportunityId: context.opportunityId,
        organizationId: context.organizationId,
        error: (err as Error).message,
      });
      return undefined;
    }
  }
}
```

- Exported from `packages/backend/src/services/value-graph/index.ts`
- Unit tested: `resolveOpportunityId` returns `value_case_id` when present, falls back to `workspace_id`, returns `undefined` when both absent; `safeWrite` swallows errors and returns `undefined`

### 3. `NarrativeAgent` — Graph Integration

**Reads:** `getValuePaths(opportunityId, organizationId)` — injects top 3 value paths into the LLM prompt as structured context (replaces ad-hoc memory retrieval for graph-connected data).

**Writes:** For each hypothesis referenced in the narrative output, one `narrative_explains_hypothesis` edge:
- `from_entity_type`: `'narrative'`
- `from_entity_id`: `randomUUID()` (narrative document ID — no stable entity yet)
- `to_entity_type`: `'value_hypothesis'`
- `to_entity_id`: `randomUUID()` (hypothesis graph ID — resolved from memory if available)
- `edge_type`: `'narrative_explains_hypothesis'`
- `confidence_score`: `narrativeOutput.defense_readiness_score` (0–1 normalised)
- `created_by_agent`: `'NarrativeAgent'`

Fire-and-forget. Graph read failure → prompt proceeds without graph context (logged). Graph write failure → output unaffected.

### 4. `TargetAgent` — Graph Integration

**Writes:** For each KPI definition in the output:

1. **`VgMetric` node** (upsert — refines FinancialModelingAgent draft):
   - `name`: `kpi.kpi_name`
   - `unit`: map `kpi.unit` → `VgMetricUnit` via `mapUnitToVgMetricUnit` (from `valueDriverUtils.ts`)
   - `baseline_value`: `kpi.baseline.value`
   - `target_value`: `kpi.target.target_value`
   - `impact_timeframe_months`: `kpi.target.timeframe_months`
   - `opportunity_id`: resolved via `BaseGraphWriter.resolveOpportunityId`
   - `organization_id`: `this.organizationId`

2. **`target_quantifies_driver`** edge: `VgMetric → VgValueDriver`
   - Look up existing `VgValueDriver` nodes for the opportunity
   - Match by `mapCategoryToValueDriverType(kpi.category)` → driver type
   - `from_entity_id`: written metric's `id`
   - `to_entity_id`: matched driver's `id` (or newly created driver if none found)
   - `confidence_score`: `kpi.confidence` (from causal verification result)
   - `created_by_agent`: `'TargetAgent'`

Fire-and-forget per KPI. One KPI failure does not abort others (per-KPI try/catch, same pattern as Sprint 48 fix).

### 5. `RealizationAgent` — Graph Integration

**Writes:** For each proof point in the output:

1. **`evidence_supports_metric`** edge: `Evidence → VgMetric`
   - `from_entity_type`: `'evidence'`
   - `from_entity_id`: `randomUUID()` (proof point ID — no stable evidence entity yet)
   - `to_entity_type`: `'vg_metric'`
   - `to_entity_id`: look up `VgMetric` by `kpi_id` match against metric names in graph; fall back to first metric if no match
   - `edge_type`: `'evidence_supports_metric'`
   - `confidence_score`: `proofPoint.confidence`
   - `created_by_agent`: `'RealizationAgent'`

This closes the `IntegrityAgent` gap loop: once `RealizationAgent` runs, `checkGraphIntegrityGaps` will find evidence edges and report zero gaps for covered claims.

Fire-and-forget per proof point.

### 6. `ExpansionAgent` — Graph Integration

**Reads:** `getGraphForOpportunity` — loads existing capability nodes to avoid duplicating capabilities already in the graph.

**Writes:** For each expansion opportunity of type `'new_use_case'` or `'upsell'`:

1. **`VgCapability` node** (new capability identified by expansion):
   - `name`: `opportunity.title`
   - `description`: `opportunity.description`
   - `category`: `'other'` (same as OpportunityAgent; refinement deferred)

2. **`expansion_extends_node`** edge: `UseCase → VgCapability`
   - `from_entity_type`: `'use_case'`
   - `from_entity_id`: resolved `opportunityId` (proxy, same as OpportunityAgent)
   - `to_entity_type`: `'vg_capability'`
   - `to_entity_id`: newly written capability's `id`
   - `confidence_score`: `opportunity.confidence`
   - `created_by_agent`: `'ExpansionAgent'`

Skip write if a capability with the same name already exists in the graph (checked against loaded nodes). Fire-and-forget per opportunity.

### 7. `ComplianceAuditorAgent` — Graph Integration

**Reads:** `getGraphForOpportunity` — uses node/edge counts and coverage as deterministic input to the compliance prompt (replaces the current memory-count heuristic for graph-connected data).

**Writes:** For each value driver node in the graph, one `audit_verifies_node` edge:
- `from_entity_type`: `'evidence'`
- `from_entity_id`: `randomUUID()` (audit record ID)
- `to_entity_type`: `'vg_value_driver'`
- `to_entity_id`: driver node's `id`
- `edge_type`: `'audit_verifies_node'`
- `confidence_score`: `deterministicCoverage.controlCoverageScore` (same score for all drivers in this audit pass)
- `created_by_agent`: `'ComplianceAuditorAgent'`

Graph read failure → falls back to existing memory-count heuristic (no regression). Fire-and-forget writes.

### 8. Value Graph API

**File:** `packages/backend/src/routes/value-graph.ts`

All endpoints:
- Require `authenticate` middleware
- Require `tenantContextMiddleware` — validates `organization_id` from JWT matches the opportunity's `organization_id` before any graph query executes (`GraphRequest` middleware pattern)
- Return `{ success: true, data: ... }` on success, `{ success: false, error: { message } }` on failure
- 404 when opportunity not found or not accessible to tenant

#### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/cases/:caseId/graph` | Full graph: all nodes + edges for the case |
| `GET` | `/api/v1/cases/:caseId/graph/paths` | Ordered value paths (UseCase → ValueDriver) |
| `GET` | `/api/v1/cases/:caseId/graph/nodes` | All nodes, optionally filtered by `?type=vg_capability` |
| `GET` | `/api/v1/cases/:caseId/graph/nodes/:nodeId` | Single node by entity ID |
| `GET` | `/api/v1/cases/:caseId/graph/edges` | All edges, optionally filtered by `?edge_type=capability_impacts_metric` |
| `POST` | `/api/v1/cases/:caseId/graph/edges` | Manual edge creation (human-in-the-loop overrides) |
| `GET` | `/api/v1/cases/:caseId/graph/integrity` | Gap report: `hypothesis_claims_value_driver` edges with no `evidence_supports_metric` counterpart |

The `POST /edges` endpoint validates the edge triple against `EDGE_TYPE_CONSTRAINTS` before writing. Returns `422` with a descriptive error if the triple is invalid.

**OpenAPI spec:** `packages/backend/openapi.yaml` updated with all 7 paths, request/response schemas, and security definitions.

---

## Acceptance Criteria

- [ ] `EDGE_TYPE_CONSTRAINTS` exported from `@valueos/shared`; `ValueGraphService.writeEdge` throws `EdgeConstraintViolationError` on invalid triple
- [ ] New edge types added to `ValueGraphEdgeTypeSchema` and DB migration CHECK constraint
- [ ] `BaseGraphWriter` exported; `resolveOpportunityId` and `safeWrite` unit tested
- [ ] `NarrativeAgent` reads top-3 value paths and injects into prompt; writes `narrative_explains_hypothesis` edges; graph failures do not affect output
- [ ] `TargetAgent` writes `VgMetric` nodes (upsert) and `target_quantifies_driver` edges; per-KPI isolation; graph failures do not affect output
- [ ] `RealizationAgent` writes `evidence_supports_metric` edges from proof points; after a `RealizationAgent` run, `IntegrityAgent.checkGraphIntegrityGaps` returns zero gaps for covered claims
- [ ] `ExpansionAgent` reads graph; skips duplicate capabilities; writes `expansion_extends_node` edges; graph failures do not affect output
- [ ] `ComplianceAuditorAgent` reads graph for prompt context; writes `audit_verifies_node` edges; graph read failure falls back to memory heuristic
- [ ] All 7 API endpoints implemented, authenticated, tenant-scoped
- [ ] `POST /edges` returns `422` for invalid edge triples
- [ ] OpenAPI spec updated
- [ ] Integration tests for each of the 5 agents (graph writes + failure isolation)
- [ ] `BaseGraphWriter` unit tests pass
- [ ] All existing agent tests pass without modification
- [ ] `pnpm test` green, `pnpm run check` green

---

## Implementation Approach

### Step 1 — Zod guardrail + new edge types in shared

**Files:** `packages/shared/src/domain/ValueGraphEdge.ts`, `packages/shared/src/domain/index.ts`

- Add 5 new edge types to `ValueGraphEdgeTypeSchema`: `narrative_explains_hypothesis`, `target_quantifies_driver`, `realization_tracks_target`, `expansion_extends_node`, `audit_verifies_node`
- Add `narrative` to `ValueGraphEntityTypeSchema` (if not present)
- Define and export `EDGE_TYPE_CONSTRAINTS` as `const satisfies` record
- Export `EdgeConstraintViolationError` class from shared domain

### Step 2 — DB migration for new edge types

**File:** `infra/supabase/supabase/migrations/20260919000000_value_graph_edge_types.sql`

- Extend `value_graph_edges.edge_type` CHECK constraint to include the 5 new edge types
- Extend `value_graph_edges.from_entity_type` / `to_entity_type` CHECK constraints to include `'narrative'` if needed
- Rollback file: `20260919000000_value_graph_edge_types.rollback.sql`

### Step 3 — `ValueGraphService.writeEdge` runtime validation

**File:** `packages/backend/src/services/value-graph/ValueGraphService.ts`

- Import `EDGE_TYPE_CONSTRAINTS` and `EdgeConstraintViolationError` from `@valueos/shared`
- At the top of `writeEdge`, validate `(from_entity_type, edge_type, to_entity_type)` against constraints
- Throw `EdgeConstraintViolationError` on mismatch (agents' `safeWrite` will catch and log it)

### Step 4 — `BaseGraphWriter`

**File:** `packages/backend/src/services/value-graph/BaseGraphWriter.ts`

- Implement `resolveOpportunityId`, `newEntityId`, `safeWrite` as specified
- Unit tests: `packages/backend/src/services/value-graph/__tests__/BaseGraphWriter.test.ts`

### Step 5 — `TargetAgent` graph integration

**File:** `packages/backend/src/lib/agent-fabric/agents/TargetAgent.ts`

- Compose `BaseGraphWriter` (instantiated in constructor using `this.valueGraphService`)
- Add `writeKpisToGraph(kpis, context)` private async method
- Call at end of `execute()`, after `storeTargetsInMemory`, before returning output
- Per-KPI try/catch isolation
- Integration test: `__tests__/TargetAgent.graph.test.ts`

### Step 6 — `RealizationAgent` graph integration

**File:** `packages/backend/src/lib/agent-fabric/agents/RealizationAgent.ts`

- Compose `BaseGraphWriter`
- Add `writeProofPointsToGraph(proofPoints, context)` private async method
- Call at end of `execute()`, after `storeRealizationInMemory`, before returning output
- Per-proof-point try/catch isolation
- Integration test: `__tests__/RealizationAgent.graph.test.ts`

### Step 7 — `NarrativeAgent` graph integration

**File:** `packages/backend/src/lib/agent-fabric/agents/NarrativeAgent.ts`

- Compose `BaseGraphWriter`
- Add `enrichPromptWithGraphPaths(context): Promise<string>` — reads top-3 paths, formats as structured text for prompt injection; returns empty string on failure
- Add `writeNarrativeEdges(narrativeOutput, context)` private async method
- Call `enrichPromptWithGraphPaths` before LLM invocation; call `writeNarrativeEdges` after
- Integration test: `__tests__/NarrativeAgent.graph.test.ts`

### Step 8 — `ExpansionAgent` graph integration

**File:** `packages/backend/src/lib/agent-fabric/agents/ExpansionAgent.ts`

- Compose `BaseGraphWriter`
- Add `writeExpansionToGraph(opportunities, context)` private async method
- Load existing capability nodes first; skip duplicates by name
- Integration test: `__tests__/ExpansionAgent.graph.test.ts`

### Step 9 — `ComplianceAuditorAgent` graph integration

**File:** `packages/backend/src/lib/agent-fabric/agents/ComplianceAuditorAgent.ts`

- Compose `BaseGraphWriter`
- Add `enrichPromptWithGraph(context): Promise<GraphSummary | null>` — reads graph, returns node/edge counts; returns `null` on failure (falls back to memory heuristic)
- Add `writeAuditEdges(graph, coverageScore, context)` private async method
- Integration test: `__tests__/ComplianceAuditorAgent.graph.test.ts`

### Step 10 — Value Graph API routes

**File:** `packages/backend/src/routes/value-graph.ts`

- Implement all 7 endpoints as specified
- `GraphRequest` middleware: validates `caseId` maps to a case owned by the authenticated tenant's `organization_id`
- Wire into Express app

### Step 11 — OpenAPI spec

**File:** `packages/backend/openapi.yaml`

- Add all 7 paths with request/response schemas
- Add `EdgeConstraintViolationError` response schema (422)

### Step 12 — Verify

- `pnpm --filter @valueos/shared run check` — zero errors
- `pnpm --filter @valueos/backend run typecheck` — no new errors
- `pnpm --filter @valueos/backend exec vitest run` — all tests pass including 5 new graph test files + `BaseGraphWriter` unit tests
- All existing agent tests pass without modification
