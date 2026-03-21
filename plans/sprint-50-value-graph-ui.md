# Sprint 50 — Value Graph: UI

## Problem Statement

The Value Graph data layer (nodes, edges, paths) was built in Sprint 47 and is fully operational via `ValueGraphService`. It is not yet surfaced in ValyntApp. Users cannot see the causal chain from use cases to value drivers, inspect metrics, or follow evidence links. This sprint wires the existing backend to three new SDUI components and adds a "Value Graph" tab to the case detail page.

---

## Scope

### KR 1 — `ValueGraphVisualization` SDUI component

A ReactFlow-based graph canvas that renders the full Value Graph for an opportunity. Nodes are color-coded by entity type; clicking a node opens the entity detail in the existing `RightInspector`.

**Entity type → color mapping:**

| Entity type        | Color token         |
|--------------------|---------------------|
| `account`          | `blue-500`          |
| `stakeholder`      | `violet-500`        |
| `use_case`         | `amber-500`         |
| `vg_capability`    | `emerald-500`       |
| `vg_metric`        | `pink-500`          |
| `vg_value_driver`  | `orange-500`        |
| `evidence`         | `zinc-400`          |
| `value_hypothesis` | `indigo-500`        |

**Layout:** `elkjs` (already in `apps/ValyntApp/package.json`) for automated directed-graph layout. Edges rendered as `smoothstep`.

**Data flow:** Component receives `opportunityId` and `organizationId` as props. Internally calls a new `useValueGraph(opportunityId, organizationId)` hook that hits a new backend API endpoint. Renders a loading skeleton while fetching.

**Node click:** Calls an `onNodeSelect(entityType, entityId)` callback prop. The parent page wires this to the `RightInspector` (reusing the existing `NodeSummaryCard`, `EvidencePanel`, `ConfidencePanel` from `living-value-graph`).

**Placement note:** Because `reactflow` is a dep of `apps/ValyntApp` only (not `packages/sdui`), `ValueGraphVisualization` lives in `apps/ValyntApp/src/components/sdui/ValueGraphVisualization.tsx` and is registered from there. The other two components (`ValuePathCard`, `MetricCard`) have no ReactFlow dep and live in `packages/sdui/src/components/SDUI/`.

### KR 2 — `ValuePathCard` SDUI component

Renders a single `ValuePath` (the ordered causal chain: UseCase → Capability → Metric → ValueDriver). Displays:
- Path confidence score (aggregate product of edge confidence scores, shown as a percentage)
- Each hop in the chain with entity name and entity type badge
- Evidence links: for each metric on the path, list linked evidence IDs as chips showing tier (`silver` / `gold` / `platinum`) with a link to `source_url` when available

### KR 3 — `MetricCard` SDUI component

Renders a single `VgMetric` node. Displays:
- Metric name and unit
- Baseline value vs. target value (formatted per unit: `usd` → `$`, `percent` → `%`, `hours`/`days`/`count`/`headcount`/`score` → raw with label)
- Impact timeframe in months
- Evidence tier badge: highest tier among evidence linked to this metric via `evidence_supports_metric` edges (`silver` / `gold` / `platinum`)
- Measurement method (truncated to 2 lines, expandable on click)

### KR 4 — "Value Graph" tab in `ValueCaseCanvas`

Add a 7th stage tab labeled **"Value Graph"** to the existing stage tab bar in `ValueCaseCanvas` (`apps/ValyntApp/src/views/ValueCaseCanvas.tsx`).

**Tab content (top to bottom):**
1. `ValueGraphVisualization` — full-width, fixed height ~500px, wired to `oppId` from route params
2. `ValuePathCard` list — one card per path from `getValuePaths`, sorted by `path_confidence` descending
3. Node click → `RightInspector` pattern: on `onNodeSelect`, show `NodeSummaryCard` + `EvidencePanel` in a right-side panel (can be a simple `useState`-driven slide-in panel within the tab, reusing the inspector components from `living-value-graph`)

**Business case summary view (`NarrativeStage`):** Add a `ValuePathCard` list section below the existing narrative content in `apps/ValyntApp/src/views/canvas/NarrativeStage.tsx`, showing the top 3 paths by confidence.

---

## Registrations Required

Both registries must be updated for each new component.

### `scripts/config/ui-registry.json`

Add three new intent entries inside the `"intents"` array:

```json
{
  "intentType": "show_value_graph",
  "component": "ValueGraphVisualization",
  "fallback": "JsonViewer",
  "description": "Interactive ReactFlow canvas of the Value Graph for an opportunity.",
  "propMappings": {
    "opportunityId": "data.opportunityId",
    "organizationId": "data.organizationId"
  }
},
{
  "intentType": "show_value_path_card",
  "component": "ValuePathCard",
  "fallback": "TextBlock",
  "description": "Renders a single causal path from UseCase to VgValueDriver with evidence links.",
  "propMappings": {
    "path": "data.path"
  }
},
{
  "intentType": "show_metric_card",
  "component": "MetricCard",
  "fallback": "MetricBadge",
  "description": "Renders a VgMetric with baseline, target, evidence tier, and measurement method.",
  "propMappings": {
    "metric": "data.metric",
    "evidenceTier": "data.evidenceTier"
  }
}
```

### `packages/sdui/src/registry.tsx`

Register `ValuePathCard` and `MetricCard` using the existing `register()` pattern (version 1). `ValueGraphVisualization` is registered separately from `apps/ValyntApp` to avoid pulling `reactflow` into the sdui package.

---

## New Files

| File | Purpose |
|------|---------|
| `apps/ValyntApp/src/components/sdui/ValueGraphVisualization.tsx` | ReactFlow graph canvas; lives in ValyntApp to keep reactflow dep scoped |
| `packages/sdui/src/components/SDUI/ValuePathCard.tsx` | Value path display SDUI component |
| `packages/sdui/src/components/SDUI/MetricCard.tsx` | Metric display SDUI component |
| `apps/ValyntApp/src/hooks/useValueGraph.ts` | Data-fetching hook: graph nodes/edges + paths |
| `apps/ValyntApp/src/api/valueGraph.ts` | API client for `GET /api/v1/opportunities/:opportunityId/value-graph` |
| `apps/ValyntApp/src/components/sdui/ValueGraphVisualization.test.tsx` | Unit tests |
| `packages/sdui/src/components/SDUI/ValuePathCard.test.tsx` | Unit tests |
| `packages/sdui/src/components/SDUI/MetricCard.test.tsx` | Unit tests |

---

## New Backend API Endpoint

**Route:** `GET /api/v1/opportunities/:opportunityId/value-graph`

**Response shape:**
```typescript
{
  graph: ValueGraph;   // from ValueGraphService.getGraphForOpportunity()
  paths: ValuePath[];  // from ValueGraphService.getValuePaths(), sorted by path_confidence desc
}
```

**Tenant scoping:** Use `req.tenantId` (already declared in `express.d.ts`) as `organization_id`. No `service_role`. Standard RLS applies.

---

## Modified Files

| File | Change |
|------|--------|
| `apps/ValyntApp/src/views/ValueCaseCanvas.tsx` | Add "Value Graph" as 7th stage; wire `ValueGraphVisualization` + `ValuePathCard` list + node-select inspector panel |
| `apps/ValyntApp/src/views/canvas/NarrativeStage.tsx` | Add top-3 `ValuePathCard` list below narrative content |
| `packages/sdui/src/components/SDUI/index.tsx` | Export `ValuePathCard`, `MetricCard` |
| `scripts/config/ui-registry.json` | Add 3 new intent entries |
| `packages/sdui/src/registry.tsx` | Register `ValuePathCard` and `MetricCard` |
| Backend route file (e.g. `packages/backend/src/routes/opportunities.ts`) | Mount new GET endpoint |

---

## Acceptance Criteria

1. `ValueGraphVisualization` renders nodes color-coded by entity type using ReactFlow with elkjs layout; pan/zoom/minimap work.
2. Clicking a node fires `onNodeSelect(entityType, entityId)`; the parent tab shows entity detail in a right-side inspector panel.
3. `ValuePathCard` renders the full causal chain with path confidence and evidence tier chips per metric.
4. `MetricCard` renders baseline, target, unit-formatted values, evidence tier badge, and measurement method.
5. All three components are registered in both `scripts/config/ui-registry.json` and `packages/sdui/src/registry.tsx`.
6. `ValueCaseCanvas` has a "Value Graph" tab that renders `ValueGraphVisualization` + `ValuePathCard` list.
7. `NarrativeStage` shows the top-3 value paths via `ValuePathCard`.
8. `useValueGraph` hook fetches from the new endpoint, is tenant-scoped, and handles loading/error states.
9. Unit tests exist for all three SDUI components: render with required props, render fallback/empty state.
10. Registry presence is asserted: tests verify `ValuePathCard` and `MetricCard` are exported from `packages/sdui/src/registry.tsx`.
11. `pnpm test` passes with no new failures.

---

## Implementation Order

1. **Backend API endpoint** — add route + controller calling `ValueGraphService.getGraphForOpportunity()` and `getValuePaths()`; wire `req.tenantId`.
2. **`apps/ValyntApp/src/api/valueGraph.ts`** — typed API client function.
3. **`useValueGraph` hook** — wraps API client; returns `{ graph, paths, isLoading, error }`.
4. **`MetricCard` component** — simplest; no external deps beyond shared domain types.
5. **`ValuePathCard` component** — depends on `ValuePath`, `VgMetric`, `VgCapability`, `VgValueDriver`, `Evidence` types.
6. **`ValueGraphVisualization` component** — ReactFlow + elkjs layout; entity-type color map; `onNodeSelect` callback; loading skeleton.
7. **Register all three** in both `scripts/config/ui-registry.json` and `packages/sdui/src/registry.tsx`; export `ValuePathCard` and `MetricCard` from `index.tsx`.
8. **`ValueCaseCanvas` tab** — add 7th stage entry; render `ValueGraphVisualization` + `ValuePathCard` list; wire node-select to inspector panel.
9. **`NarrativeStage` patch** — add top-3 `ValuePathCard` list section.
10. **Unit tests** — all three components + registry presence assertions.
11. **`pnpm test` green** — verify no regressions.

---

## Constraints

- `reactflow` is a dep of `apps/ValyntApp` only. `ValueGraphVisualization` must not be placed in `packages/sdui` to avoid pulling that dep into the package.
- All backend queries must include `organization_id` — no cross-tenant data.
- No `(req as any)` casts — use `req.tenantId` directly.
- Named exports only on all new files.
- TypeScript strict mode — no `any`; use `unknown` + type guards.
- `elkjs` is already in `apps/ValyntApp/package.json`; no new dependency needed.
