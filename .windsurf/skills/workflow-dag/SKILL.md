---
name: workflow-dag
description: |
  Use when the user wants to add a new workflow, create a new lifecycle flow,
  define a new agent pipeline, or add a new multi-stage process. Handles
  requests like "add a compliance review workflow", "create a new approval
  workflow", "add a workflow for contract negotiation", or "define a new
  lifecycle stage sequence". Covers DAG definition, stage creation, transition
  wiring, compensation handlers, and cycle validation.
---

# Workflow DAG

Workflow DAGs are defined in:
`packages/backend/src/services/workflows/WorkflowDAGDefinitions.ts`

Types are in `packages/backend/src/types/workflow.ts`.
Saga persistence uses `workflow_states` table via `SagaAdapters.ts`.

## Core constraints

- **No cycles** — transitions must form a directed acyclic graph
- **Every stage needs a `compensation_handler`** — name a function that undoes the stage's state mutation (saga pattern)
- **`WorkflowState` must be persisted after every node transition** — `SupabaseSagaPersistence.saveState()` handles this; do not bypass it
- **`agent_type` must match a registered lifecycle stage** — valid values: `"opportunity" | "target" | "realization" | "expansion" | "integrity"`

## Workflow

### Step 1: Define stages

Use `createStage()` for each node. Choose a retry config by risk:

| Config | Use for |
|---|---|
| `RETRY_CONFIGS.STANDARD` | Most stages (3 attempts, exponential backoff) |
| `RETRY_CONFIGS.AGGRESSIVE` | Commitment/approval stages (5 attempts) |
| `RETRY_CONFIGS.CONSERVATIVE` | Expensive LLM stages (2 attempts) |
| `RETRY_CONFIGS.NONE` | Idempotent read-only stages |

```typescript
createStage(
  'stage_id',          // unique snake_case id
  'Human-readable name',
  'opportunity',       // agent_type — must be a valid LifecycleStage
  90,                  // timeout_seconds
  RETRY_CONFIGS.STANDARD,
  'compensateStageName',  // compensation handler name — required
  ['capability_1'],    // required_capabilities — optional
)
```

### Step 2: Define transitions

List every edge. Transitions must not create cycles.

```typescript
transitions: [
  { from_stage: 'stage_a', to_stage: 'stage_b' },
  { from_stage: 'stage_b', to_stage: 'stage_c' },
],
```

For conditional transitions, add a `condition` string that the `WorkflowRunner` evaluates.

### Step 3: Assemble the DAG

Follow the template in [references/dag-template.ts](references/dag-template.ts).

Required fields: `id`, `name`, `description`, `version`, `stages`, `transitions`, `initial_stage`, `final_stages`.

Export the DAG as a named constant: `export const MY_WORKFLOW: WorkflowDAG = { ... }`.

### Step 4: Register the DAG

Registration happens in **`WorkflowDAGDefinitions.ts`** — not `WorkflowDAGIntegration.ts`.

1. Export the DAG constant from `WorkflowDAGDefinitions.ts` (same file where it's defined).
2. Add it to `WORKFLOW_REGISTRY`:

```typescript
export const WORKFLOW_REGISTRY = {
  // ...existing entries...
  MY_WORKFLOW: MY_WORKFLOW,
} as const;
```

`ALL_WORKFLOW_DEFINITIONS` is derived from `Object.values(WORKFLOW_REGISTRY)` and is what
`WorkflowDAGExecutor.registerAllWorkflows()` iterates at startup — so adding to the registry
is the only step required. Do not modify `WorkflowDAGIntegration.ts`.

### Step 5: Write compensation handlers

For each `compensation_handler` name referenced in stages, implement the function that rolls back that stage's side effects. Compensation functions must be idempotent.

### Step 6: Verify

`validateWorkflowDAG()` runs automatically inside `registerAllWorkflows()` and checks:
- `initial_stage` and all `final_stages` reference real stage ids
- All transition `from_stage` / `to_stage` values reference real stage ids
- Stages with no outgoing transitions (other than final stages) are flagged as warnings

It does **not** detect cycles algorithmically — manually confirm no transition path leads back to a previously visited stage before merging.

```bash
pnpm run lint
pnpm test -- packages/backend/src/services/workflows/__tests__/
```

## Do not proceed if

- Any stage's `agent_type` is not a valid `LifecycleStage` — the orchestrator will fail to instantiate the agent
- A transition creates a cycle — the DAG executor will loop indefinitely
- A stage has no `compensation_handler` — the saga cannot roll back on failure
- `initial_stage` does not match any stage `id` — the workflow cannot start

## Completion report

```
DAG constant:         MY_WORKFLOW in WorkflowDAGDefinitions.ts
Stages:               X stages defined
Transitions:          X edges, no cycles confirmed
Compensation fns:     X handlers named
Registered in:        WORKFLOW_REGISTRY in WorkflowDAGDefinitions.ts
Commands run:         pnpm run lint  →  no errors
                      pnpm test -- ...workflows/__tests__/  →  X passed
Unresolved:           [any open items]
```

## Anti-patterns

| Pattern | Fix |
|---|---|
| Stage with no `compensation_handler` | Name a compensation function — even a no-op stub |
| `agent_type: "modeling"` | Valid values are `opportunity \| target \| realization \| expansion \| integrity` |
| Transition that creates a back-edge | Remove it — DAGs must be acyclic |
| DAG not exported as a named const | Use `export const MY_WORKFLOW: WorkflowDAG` |
| `final_stages` omitted | Always set — the executor uses it to detect completion |
